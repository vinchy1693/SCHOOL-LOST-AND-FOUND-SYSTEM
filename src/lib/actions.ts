"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "./auth";
import { q, q1, run, withTx } from "./db";
import { notify } from "./notify";
import { saveImage } from "./upload";
import { safePath } from "./format";
import type { Claim, Item, LostReport, User } from "./types";

// ---------------------------------------------------------------- helpers

function str(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function int(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function flag(fd: FormData, key: string): boolean {
  const value = fd.get(key);
  return value === "on" || value === "1" || value === "true";
}

function backWith(path: string, key: "err" | "ok", message: string): never {
  const joiner = path.includes("?") ? "&" : "?";
  redirect(`${path}${joiner}${key}=${encodeURIComponent(message)}`);
}

function refresh(): void {
  revalidatePath("/", "layout");
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function currentUserOrLogin(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

async function staffIds(): Promise<number[]> {
  const rows = await q<{ user_id: number }>(
    "SELECT user_id FROM users WHERE role_id <= 2 AND is_active = 1"
  );
  return rows.map((r) => r.user_id);
}

// ------------------------------------------------------------------- auth

export async function registerAction(fd: FormData): Promise<void> {
  const fullName = str(fd, "full_name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const userTypeRaw = str(fd, "user_type");
  const userType = ["student", "faculty", "staff", "guest"].includes(userTypeRaw)
    ? userTypeRaw
    : "student";

  if (fullName.length < 2) backWith("/register", "err", "Please enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    backWith("/register", "err", "Please enter a valid email address.");
  }
  if (password.length < 6) {
    backWith("/register", "err", "Password must be at least 6 characters.");
  }
  if (await q1("SELECT user_id FROM users WHERE email = ?", [email])) {
    backWith("/register", "err", "That email is already registered. Try logging in.");
  }

  const hash = await hashPassword(password);
  let newId = 0;
  try {
    const result = await run(
      `INSERT INTO users
        (role_id, department_id, user_type, id_number, full_name, email, phone, password_hash, year_level)
       VALUES (3, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        int(fd, "department_id"),
        userType,
        str(fd, "id_number") || null,
        fullName,
        email,
        str(fd, "phone") || null,
        hash,
        str(fd, "year_level") || null,
      ]
    );
    newId = Number(result.insertId);
  } catch {
    backWith("/register", "err", "That email or ID number is already in use.");
  }

  await createSession(newId);
  redirect("/feed");
}

export async function loginAction(fd: FormData): Promise<void> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) backWith("/login", "err", "Enter your email and password.");

  const user = await q1<User & { password_hash: string }>(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    backWith("/login", "err", "Wrong email or password.");
  }
  if (!user.is_active) {
    backWith("/login", "err", "This account has been disabled.");
  }

  await createSession(user.user_id);
  redirect(user.role_id <= 2 ? "/dashboard" : "/feed");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ------------------------------------------------------------ lost reports

export async function createLostReportAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const title = str(fd, "title");
  const categoryId = int(fd, "category_id");
  const dateLost = str(fd, "date_lost");

  if (title.length < 3) backWith("/lost/new", "err", "Give your lost item a clear title.");
  if (!categoryId) backWith("/lost/new", "err", "Choose a category.");
  if (!dateLost) backWith("/lost/new", "err", "Choose the date you lost it.");
  if (dateLost > todayISO()) backWith("/lost/new", "err", "The date lost cannot be in the future.");

  const result = await run(
    `INSERT INTO lost_report
       (user_id, category_id, title, description, brand, color, last_seen_location, date_lost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.user_id,
      categoryId,
      title,
      str(fd, "description") || null,
      str(fd, "brand") || null,
      str(fd, "color") || null,
      str(fd, "last_seen_location") || null,
      dateLost,
    ]
  );
  const lostReportId = Number(result.insertId);

  // Nudge people who already filed a found item in the same category.
  const candidates = await q<{ item_id: number; title: string; reported_by: number }>(
    `SELECT item_id, title, reported_by FROM item
     WHERE status IN ('found', 'in_storage') AND category_id = ? AND reported_by <> ?
     ORDER BY created_at DESC LIMIT 30`,
    [categoryId, user.user_id]
  );
  const told = new Set<number>();
  for (const candidate of candidates) {
    if (told.has(candidate.reported_by)) continue;
    told.add(candidate.reported_by);
    await notify(
      candidate.reported_by,
      "item_found",
      `${user.full_name} lost a "${title}". You reported finding "${candidate.title}" — is it the same? Open the post and reply with a link to your item.`,
      { itemId: candidate.item_id, lostId: lostReportId }
    );
  }

  refresh();
  redirect(
    `/lost/${lostReportId}?ok=${encodeURIComponent(
      "Your lost item is posted. Finders can reply here with the item they found."
    )}`
  );
}

export async function closeLostReportAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const lostReportId = int(fd, "lost_report_id");
  if (!lostReportId) redirect("/lost");
  const report = await q1<LostReport>(
    "SELECT * FROM lost_report WHERE lost_report_id = ?",
    [lostReportId]
  );
  if (!report) backWith("/lost", "err", "That post no longer exists.");
  if (report.user_id !== user.user_id && user.role_id > 2) {
    backWith(`/lost/${lostReportId}`, "err", "Only the owner or staff can close this post.");
  }
  await run("UPDATE lost_report SET status = 'closed' WHERE lost_report_id = ?", [lostReportId]);
  refresh();
  redirect(`/lost/${lostReportId}?ok=${encodeURIComponent("Post closed. Glad it worked out!")}`);
}

export async function reopenLostReportAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const lostReportId = int(fd, "lost_report_id");
  if (!lostReportId) redirect("/lost");
  const report = await q1<LostReport>(
    "SELECT * FROM lost_report WHERE lost_report_id = ?",
    [lostReportId]
  );
  if (!report) redirect("/lost");
  if (report.user_id !== user.user_id && user.role_id > 2) redirect(`/lost/${lostReportId}`);
  await run("UPDATE lost_report SET status = 'open' WHERE lost_report_id = ?", [lostReportId]);
  refresh();
  redirect(`/lost/${lostReportId}?ok=${encodeURIComponent("Post reopened.")}`);
}

// ---------------------------------------------------------------- messages

export async function postMessageAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const lostReportId = int(fd, "lost_report_id");
  if (!lostReportId) redirect("/feed");

  const report = await q1<{ user_id: number; title: string }>(
    "SELECT user_id, title FROM lost_report WHERE lost_report_id = ?",
    [lostReportId]
  );
  if (!report) backWith("/feed", "err", "That post no longer exists.");

  const body = str(fd, "body");
  const linkedItemId = int(fd, "linked_item_id");
  if (!body && !linkedItemId) {
    backWith(`/lost/${lostReportId}`, "err", "Write a message or attach a found item.");
  }
  if (body.length > 2000) {
    backWith(`/lost/${lostReportId}`, "err", "Keep replies under 2000 characters.");
  }

  let item: Pick<Item, "item_id" | "title"> | null = null;
  if (linkedItemId) {
    item = await q1<Pick<Item, "item_id" | "title">>(
      "SELECT item_id, title FROM item WHERE item_id = ?",
      [linkedItemId]
    );
    if (!item) backWith(`/lost/${lostReportId}`, "err", "That found item no longer exists.");
  }

  const text =
    body ||
    (item
      ? `I found this item — "${item.title}". Is it yours?`
      : "I have an update about this item.");

  const result = await run(
    "INSERT INTO post_message (lost_report_id, sender_id, body, linked_item_id) VALUES (?, ?, ?, ?)",
    [lostReportId, user.user_id, text, item?.item_id ?? null]
  );
  const messageId = Number(result.insertId);

  if (item) {
    await run(
      "UPDATE lost_report SET status = 'matched' WHERE lost_report_id = ? AND status = 'open'",
      [lostReportId]
    );
  }

  const recipients = new Set<number>();
  if (report.user_id !== user.user_id) recipients.add(report.user_id);
  const previous = await q<{ sender_id: number }>(
    "SELECT DISTINCT sender_id FROM post_message WHERE lost_report_id = ? AND sender_id <> ? LIMIT 10",
    [lostReportId, user.user_id]
  );
  for (const row of previous) {
    if (row.sender_id !== report.user_id) recipients.add(row.sender_id);
  }
  for (const recipient of recipients) {
    await notify(
      recipient,
      "new_message",
      `${user.full_name} replied to "${report.title}"${item ? " and linked a found item" : ""}.`,
      { lostId: lostReportId, itemId: item?.item_id ?? null }
    );
  }

  refresh();
  redirect(
    `/lost/${lostReportId}?ok=${encodeURIComponent("Reply posted.")}#m${messageId}`
  );
}

export async function markThreadReadAction(lostReportId: number): Promise<void> {
  const user = await getSessionUser();
  if (!user || !lostReportId) return;
  await run(
    `INSERT INTO lost_report_read (lost_report_id, user_id, last_read_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
    [lostReportId, user.user_id]
  );
}

// ------------------------------------------------------------- found items

export async function createFoundItemAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const title = str(fd, "title");
  const categoryId = int(fd, "category_id");
  const dateFound = str(fd, "date_found");
  const location = str(fd, "found_location");
  const responseLostId = int(fd, "response_to_lost_report_id");

  if (title.length < 3) backWith("/items/new", "err", "Give the item a clear title.");
  if (!categoryId) backWith("/items/new", "err", "Choose a category.");
  if (!dateFound) backWith("/items/new", "err", "Choose the date you found it.");
  if (dateFound > todayISO()) backWith("/items/new", "err", "The date found cannot be in the future.");
  if (!location) backWith("/items/new", "err", "Tell people where you found it.");

  let report: Pick<LostReport, "lost_report_id" | "user_id" | "title"> | null = null;
  if (responseLostId) {
    report = await q1<Pick<LostReport, "lost_report_id" | "user_id" | "title">>(
      "SELECT lost_report_id, user_id, title FROM lost_report WHERE lost_report_id = ?",
      [responseLostId]
    );
    if (!report) backWith("/items/new", "err", "That lost post no longer exists.");
  }

  let imagePath: string | null = null;
  try {
    imagePath = await saveImage(fd.get("image"));
  } catch (err) {
    backWith("/items/new", "err", (err as Error).message);
  }

  let itemId = 0;
  try {
    itemId = await withTx(async (conn: PoolConnection) => {
      const tempCode = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [insertResult] = await conn.query(
        `INSERT INTO item
           (item_code, category_id, found_location_id, found_location_text, storage_location_id,
            reported_by, response_to_lost_report_id, title, description, brand, color,
            found_id_number, date_found, status, is_valuable)
         VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'found', ?)`,
        [
          tempCode,
          categoryId,
          location,
          user.user_id,
          report?.lost_report_id ?? null,
          title,
          str(fd, "description") || null,
          str(fd, "brand") || null,
          str(fd, "color") || null,
          str(fd, "found_id_number") || null,
          dateFound,
          flag(fd, "is_valuable") ? 1 : 0,
        ]
      );
      const id = Number((insertResult as ResultSetHeader).insertId);
      const code = `LF-${dateFound.slice(0, 4)}-${String(id).padStart(4, "0")}`;
      await conn.query("UPDATE item SET item_code = ? WHERE item_id = ?", [code, id]);
      if (imagePath) {
        await conn.query(
          "INSERT INTO item_image (item_id, file_path, is_primary) VALUES (?, ?, 1)",
          [id, imagePath]
        );
      }
      await conn.query(
        `INSERT INTO item_status_history (item_id, changed_by, old_status, new_status, remarks)
         VALUES (?, ?, NULL, 'found', ?)`,
        [id, user.user_id, "Reported found by finder"]
      );

      if (report) {
        const note = str(fd, "note");
        const body =
          note || `I found this item — "${title}". Is it yours?`;
        await conn.query(
          "INSERT INTO post_message (lost_report_id, sender_id, body, linked_item_id) VALUES (?, ?, ?, ?)",
          [report.lost_report_id, user.user_id, body, id]
        );
        await conn.query(
          "UPDATE lost_report SET status = 'matched' WHERE lost_report_id = ? AND status = 'open'",
          [report.lost_report_id]
        );
      }
      return id;
    });
  } catch (err) {
    backWith("/items/new", "err", `Could not save the item: ${(err as Error).message}`);
  }

  if (report) {
    await notify(
      report.user_id,
      "new_message",
      `${user.full_name} found an item and replied to your post "${report.title}" with a link to it.`,
      { itemId, lostId: report.lost_report_id }
    );
  } else {
    // Let owners of open reports in the same category know something turned up.
    const openReports = await q<{ lost_report_id: number; user_id: number; title: string }>(
      `SELECT lost_report_id, user_id, title FROM lost_report
       WHERE status = 'open' AND category_id = ? AND user_id <> ?
       ORDER BY created_at DESC LIMIT 15`,
      [categoryId, user.user_id]
    );
    for (const openReport of openReports) {
      await notify(
        openReport.user_id,
        "item_found",
        `Someone found a "${title}" at ${location}. Open it to see if it is yours.`,
        { itemId }
      );
    }
  }

  refresh();
  redirect(
    `/items/${itemId}?ok=${encodeURIComponent(
      report
        ? "Item filed and posted to the lost-item thread."
        : "Item filed. Anyone who lost it can now find and claim it."
    )}`
  );
}

export async function linkItemToLostReportAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const itemId = int(fd, "item_id");
  const lostReportId = int(fd, "lost_report_id");
  if (!itemId) redirect("/items");

  const item = await q1<Pick<Item, "item_id" | "title" | "reported_by">>(
    "SELECT item_id, title, reported_by FROM item WHERE item_id = ?",
    [itemId]
  );
  if (!item) redirect("/items");
  if (item.reported_by !== user.user_id && user.role_id > 2) {
    backWith(`/items/${itemId}`, "err", "Only the finder or staff can link this item.");
  }
  if (!lostReportId) backWith(`/items/${itemId}`, "err", "Choose a lost post to link to.");

  const report = await q1<{ lost_report_id: number; user_id: number; title: string }>(
    "SELECT lost_report_id, user_id, title FROM lost_report WHERE lost_report_id = ?",
    [lostReportId]
  );
  if (!report) backWith(`/items/${itemId}`, "err", "That lost post no longer exists.");

  const note = str(fd, "note");
  await run(
    "UPDATE item SET response_to_lost_report_id = ? WHERE item_id = ?",
    [lostReportId, itemId]
  );
  await run(
    "INSERT INTO post_message (lost_report_id, sender_id, body, linked_item_id) VALUES (?, ?, ?, ?)",
    [
      lostReportId,
      user.user_id,
      note || `${user.full_name} linked "${item.title}" to this post.`,
      itemId,
    ]
  );
  await run(
    "UPDATE lost_report SET status = 'matched' WHERE lost_report_id = ? AND status = 'open'",
    [lostReportId]
  );
  if (report.user_id !== user.user_id) {
    await notify(
      report.user_id,
      "new_message",
      `An item was linked to your post "${report.title}". Open the post to check it.`,
      { itemId, lostId: lostReportId }
    );
  }

  refresh();
  redirect(
    `/items/${itemId}?ok=${encodeURIComponent("Item linked to the lost post and the owner was notified.")}`
  );
}

// ------------------------------------------------------------------ claims

export async function claimItemAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const itemId = int(fd, "item_id");
  if (!itemId) redirect("/items");

  const item = await q1<Pick<Item, "item_id" | "title" | "status" | "reported_by">>(
    "SELECT item_id, title, status, reported_by FROM item WHERE item_id = ?",
    [itemId]
  );
  if (!item) backWith("/items", "err", "That item no longer exists.");
  if (item.reported_by === user.user_id) {
    backWith(`/items/${itemId}`, "err", "You reported finding this item, so you cannot claim it.");
  }
  if (!["found", "in_storage"].includes(item.status)) {
    backWith(`/items/${itemId}`, "err", "This item is no longer available to claim.");
  }
  const existing = await q1(
    `SELECT claim_id FROM claim
     WHERE item_id = ? AND claimant_id = ? AND claim_status IN ('pending', 'approved')`,
    [itemId, user.user_id]
  );
  if (existing) {
    backWith(`/items/${itemId}`, "err", "You already have an active claim on this item.");
  }

  const description = str(fd, "description_provided");
  if (description.length < 10) {
    backWith(`/items/${itemId}`, "err", "Describe the item in at least 10 characters.");
  }

  let lostReportId = int(fd, "lost_report_id");
  if (lostReportId) {
    const owned = await q1(
      "SELECT lost_report_id FROM lost_report WHERE lost_report_id = ? AND user_id = ?",
      [lostReportId, user.user_id]
    );
    if (!owned) lostReportId = null;
  }

  const evidenceTypeRaw = str(fd, "evidence_type");
  const evidenceType = [
    "photo",
    "receipt",
    "id",
    "serial_number",
    "other",
  ].includes(evidenceTypeRaw)
    ? evidenceTypeRaw
    : "other";
  const evidenceDetails = str(fd, "evidence_details");

  let claimId = 0;
  claimId = await withTx(async (conn) => {
    const [insertResult] = await conn.query(
      `INSERT INTO claim (item_id, claimant_id, lost_report_id, description_provided)
       VALUES (?, ?, ?, ?)`,
      [itemId, user.user_id, lostReportId, description]
    );
    const id = Number((insertResult as ResultSetHeader).insertId);
    if (evidenceDetails) {
      await conn.query(
        "INSERT INTO claim_evidence (claim_id, evidence_type, details) VALUES (?, ?, ?)",
        [id, evidenceType, evidenceDetails]
      );
    }
    return id;
  });

  const recipients = new Set<number>([item.reported_by, ...(await staffIds())]);
  for (const recipient of recipients) {
    await notify(
      recipient,
      "general",
      `${user.full_name} submitted a claim for "${item.title}".`,
      { itemId, claimId }
    );
  }

  refresh();
  redirect(
    `/items/${itemId}?ok=${encodeURIComponent(
      "Claim submitted. The finder and staff will review it."
    )}`
  );
}

export async function reviewClaimAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const claimId = int(fd, "claim_id");
  const decision = str(fd, "decision");
  const redirectTo = safePath(str(fd, "redirect_to"), "/dashboard/claims");
  if (!claimId) redirect(redirectTo);
  if (!["approved", "rejected"].includes(decision)) {
    backWith(redirectTo, "err", "Choose approve or reject.");
  }

  const claim = await q1<Claim>(
    `SELECT cl.*, i.status AS item_status, i.reported_by AS finder_id, i.title AS item_title
     FROM claim cl JOIN item i ON i.item_id = cl.item_id
     WHERE cl.claim_id = ?`,
    [claimId]
  );
  if (!claim) backWith(redirectTo, "err", "That claim no longer exists.");

  const allowed = user.role_id <= 2 || claim.finder_id === user.user_id;
  if (!allowed) backWith(redirectTo, "err", "You cannot review this claim.");
  if (claim.claim_status !== "pending") {
    backWith(redirectTo, "err", "This claim was already reviewed.");
  }

  const remarks = str(fd, "remarks");
  const otherClaimants: number[] = [];

  await withTx(async (conn) => {
    if (decision === "approved") {
      const [itemRows] = await conn.query(
        "SELECT status FROM item WHERE item_id = ? FOR UPDATE",
        [claim.item_id]
      );
      const status = (itemRows as Array<{ status: string }>)[0]?.status;
      if (!status || !["found", "in_storage"].includes(status)) {
        throw new Error("This item is no longer available.");
      }
      await conn.query("UPDATE item SET status = 'claimed' WHERE item_id = ?", [claim.item_id]);
      await conn.query(
        `INSERT INTO item_status_history (item_id, changed_by, old_status, new_status, remarks)
         VALUES (?, ?, ?, 'claimed', ?)`,
        [claim.item_id, user.user_id, status, `Claim #${claim.claim_id} approved`]
      );
      const [others] = await conn.query(
        `SELECT claim_id, claimant_id FROM claim
         WHERE item_id = ? AND claim_id <> ? AND claim_status = 'pending'`,
        [claim.item_id, claim.claim_id]
      );
      for (const other of others as Array<{ claim_id: number; claimant_id: number }>) {
        otherClaimants.push(other.claimant_id);
      }
      await conn.query(
        `UPDATE claim SET claim_status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), remarks = ?
         WHERE item_id = ? AND claim_id <> ? AND claim_status = 'pending'`,
        [user.user_id, "Another claim for this item was approved.", claim.item_id, claim.claim_id]
      );
    }
    await conn.query(
      "UPDATE claim SET claim_status = ?, reviewed_by = ?, reviewed_at = NOW(), remarks = ? WHERE claim_id = ?",
      [decision, user.user_id, remarks || null, claim.claim_id]
    );
  });

  const itemLink = `/items/${claim.item_id}`;
  if (decision === "approved") {
    await notify(
      claim.claimant_id,
      "claim_update",
      `Your claim for "${claim.item_title}" was approved. Arrange the hand-over from ${itemLink}.`,
      { itemId: claim.item_id, claimId: claim.claim_id }
    );
    for (const claimant of otherClaimants) {
      await notify(
        claimant,
        "claim_update",
        `Another claim was approved for "${claim.item_title}", so your pending claim was closed.`,
        { itemId: claim.item_id, claimId: claim.claim_id }
      );
    }
    if (claim.finder_id && claim.finder_id !== user.user_id) {
      await notify(
        claim.finder_id,
        "claim_update",
        `A claim for "${claim.item_title}" was approved. The owner will contact you through the item page.`,
        { itemId: claim.item_id, claimId: claim.claim_id }
      );
    }
  } else {
    await notify(
      claim.claimant_id,
      "claim_update",
      `Your claim for "${claim.item_title}" was rejected.${remarks ? ` Reason: ${remarks}` : ""}`,
      { itemId: claim.item_id, claimId: claim.claim_id }
    );
  }

  refresh();
  redirect(
    `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}ok=${encodeURIComponent(
      decision === "approved" ? "Claim approved." : "Claim rejected."
    )}`
  );
}

export async function releaseItemAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const claimId = int(fd, "claim_id");
  const redirectTo = safePath(str(fd, "redirect_to"), "/dashboard/claims");
  if (!claimId) redirect(redirectTo);

  const claim = await q1<Claim>(
    `SELECT cl.*, i.title AS item_title, i.reported_by AS finder_id,
            i.response_to_lost_report_id
     FROM claim cl JOIN item i ON i.item_id = cl.item_id
     WHERE cl.claim_id = ?`,
    [claimId]
  );
  if (!claim) backWith(redirectTo, "err", "That claim no longer exists.");
  if (user.role_id > 2 && claim.finder_id !== user.user_id) {
    backWith(redirectTo, "err", "Only the finder or staff can release this item.");
  }
  if (claim.claim_status !== "approved") {
    backWith(redirectTo, "err", "Only an approved claim can be handed over.");
  }

  const receivedBy = str(fd, "received_by_name");
  const idPresented = str(fd, "id_presented");
  if (!receivedBy || !idPresented) {
    backWith(redirectTo, "err", "Record who received the item and the ID they presented.");
  }

  const existing = await q1(
    "SELECT item_return_id FROM item_return WHERE claim_id = ?",
    [claimId]
  );
  if (existing) backWith(redirectTo, "err", "This item was already released.");

  await withTx(async (conn) => {
    const [itemRows] = await conn.query(
      "SELECT status FROM item WHERE item_id = ? FOR UPDATE",
      [claim.item_id]
    );
    const status = (itemRows as Array<{ status: string }>)[0]?.status;
    await conn.query(
      "INSERT INTO item_return (claim_id, released_by, received_by_name, id_presented) VALUES (?, ?, ?, ?)",
      [claimId, user.user_id, receivedBy, idPresented]
    );
    await conn.query("UPDATE item SET status = 'returned' WHERE item_id = ?", [claim.item_id]);
    await conn.query(
      `INSERT INTO item_status_history (item_id, changed_by, old_status, new_status, remarks)
       VALUES (?, ?, ?, 'returned', ?)`,
      [claim.item_id, user.user_id, status ?? null, `Handed over to ${receivedBy}`]
    );
    const lostIds = new Set<number>();
    if (claim.lost_report_id) lostIds.add(claim.lost_report_id);
    if (claim.response_to_lost_report_id) lostIds.add(claim.response_to_lost_report_id);
    for (const lostId of lostIds) {
      await conn.query(
        "UPDATE lost_report SET status = 'closed' WHERE lost_report_id = ?",
        [lostId]
      );
    }
  });

  await notify(
    claim.claimant_id,
    "item_returned",
    `Your "${claim.item_title}" was handed over to you. Glad it found its way home!`,
    { itemId: claim.item_id, claimId }
  );

  refresh();
  redirect(
    `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}ok=${encodeURIComponent(
      "Item marked as returned."
    )}`
  );
}

// -------------------------------------------------------------- item admin

export async function updateStorageAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const itemId = int(fd, "item_id");
  if (!itemId) redirect("/items");
  const item = await q1<Pick<Item, "item_id" | "status" | "reported_by">>(
    "SELECT item_id, status, reported_by FROM item WHERE item_id = ?",
    [itemId]
  );
  if (!item) redirect("/items");
  if (user.role_id > 2 && item.reported_by !== user.user_id) {
    backWith(`/items/${itemId}`, "err", "Only the finder or staff can update this item.");
  }
  if (!["found", "in_storage", "claimed"].includes(item.status)) {
    backWith(`/items/${itemId}`, "err", "This item is already closed out.");
  }

  const storageId = int(fd, "storage_location_id");
  if (storageId) {
    const storage = await q1("SELECT location_id FROM location WHERE location_id = ? AND location_type = 'storage'", [storageId]);
    if (!storage) backWith(`/items/${itemId}`, "err", "Choose a valid storage location.");
  }
  const newStatus =
    item.status === "claimed" ? "claimed" : storageId ? "in_storage" : "found";

  await run("UPDATE item SET storage_location_id = ? WHERE item_id = ?", [storageId, itemId]);
  if (newStatus !== item.status) {
    await run("UPDATE item SET status = ? WHERE item_id = ?", [newStatus, itemId]);
    await run(
      `INSERT INTO item_status_history (item_id, changed_by, old_status, new_status, remarks)
       VALUES (?, ?, ?, ?, ?)`,
      [itemId, user.user_id, item.status, newStatus, storageId ? "Moved to storage" : "Storage cleared"]
    );
  }

  refresh();
  redirect(`/items/${itemId}?ok=${encodeURIComponent("Storage updated.")}`);
}

export async function disposeItemAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  if (user.role_id > 2) redirect("/feed");
  const itemId = int(fd, "item_id");
  if (!itemId) redirect("/items");
  const method = str(fd, "disposal_method");
  if (!["donated", "recycled", "discarded"].includes(method)) {
    backWith(`/items/${itemId}`, "err", "Choose a disposal method.");
  }
  const item = await q1<Pick<Item, "item_id" | "status">>(
    "SELECT item_id, status FROM item WHERE item_id = ?",
    [itemId]
  );
  if (!item) redirect("/items");
  if (!["found", "in_storage"].includes(item.status)) {
    backWith(`/items/${itemId}`, "err", "Only unclaimed items can be disposed of.");
  }

  await withTx(async (conn) => {
    await conn.query(
      `INSERT INTO disposal (item_id, approved_by, disposal_method, donated_to, remarks)
       VALUES (?, ?, ?, ?, ?)`,
      [itemId, user.user_id, method, str(fd, "donated_to") || null, str(fd, "remarks") || null]
    );
    await conn.query("UPDATE item SET status = 'disposed' WHERE item_id = ?", [itemId]);
    await conn.query(
      `INSERT INTO item_status_history (item_id, changed_by, old_status, new_status, remarks)
       VALUES (?, ?, ?, 'disposed', ?)`,
      [itemId, user.user_id, item.status, `Disposed: ${method}`]
    );
  });

  refresh();
  redirect(`/items/${itemId}?ok=${encodeURIComponent("Item marked as disposed.")}`);
}

export async function confirmMatchAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  if (user.role_id > 2) redirect("/feed");
  const lostReportId = int(fd, "lost_report_id");
  const itemId = int(fd, "item_id");
  const score = str(fd, "score");
  if (!lostReportId || !itemId) redirect("/dashboard/reports");

  const report = await q1<LostReport>(
    "SELECT * FROM lost_report WHERE lost_report_id = ?",
    [lostReportId]
  );
  const item = await q1<Pick<Item, "item_id" | "title" | "status">>(
    "SELECT item_id, title, status FROM item WHERE item_id = ?",
    [itemId]
  );
  if (!report || !item) redirect("/dashboard/reports");

  await run(
    `INSERT INTO item_match (lost_report_id, item_id, matched_by, match_score, match_status)
     VALUES (?, ?, ?, ?, 'confirmed')
     ON DUPLICATE KEY UPDATE match_status = 'confirmed', matched_by = VALUES(matched_by),
       match_score = VALUES(match_score)`,
    [lostReportId, itemId, user.user_id, Number(score) || null]
  );
  await run("UPDATE lost_report SET status = 'matched' WHERE lost_report_id = ?", [lostReportId]);
  await run(
    "UPDATE item SET response_to_lost_report_id = ? WHERE item_id = ?",
    [lostReportId, itemId]
  );
  await run(
    "INSERT INTO post_message (lost_report_id, sender_id, body, linked_item_id) VALUES (?, ?, ?, ?)",
    [
      lostReportId,
      user.user_id,
      `Good news — staff matched this found item to your report. Open it and submit a claim if it is yours.`,
      itemId,
    ]
  );
  if (report.user_id !== user.user_id) {
    await notify(
      report.user_id,
      "match_found",
      `Staff matched a found item to your report "${report.title}". Open the post to see it.`,
      { itemId, lostId: lostReportId }
    );
  }

  refresh();
  redirect(
    `/dashboard/reports?match=${lostReportId}&ok=${encodeURIComponent("Match confirmed and the owner was notified.")}`
  );
}

// ------------------------------------------------------------- notifications

export async function markNotificationsReadAction(fd: FormData): Promise<void> {
  const user = await currentUserOrLogin();
  const single = int(fd, "notification_id");
  if (single) {
    await run(
      "UPDATE notification SET is_read = 1 WHERE user_id = ? AND notification_id = ?",
      [user.user_id, single]
    );
  } else {
    await run("UPDATE notification SET is_read = 1 WHERE user_id = ?", [user.user_id]);
  }
  refresh();
  redirect("/notifications");
}

// -------------------------------------------------------------------- admin

export async function updateUserAction(fd: FormData): Promise<void> {
  const admin = await currentUserOrLogin();
  if (admin.role_id !== 1) redirect("/feed");
  const userId = int(fd, "user_id");
  if (!userId) redirect("/admin/users");
  if (userId === admin.user_id) {
    backWith("/admin/users", "err", "You cannot change your own role or status.");
  }
  const roleId = Number(str(fd, "role_id"));
  if (![1, 2, 3].includes(roleId)) backWith("/admin/users", "err", "Invalid role.");
  const active = flag(fd, "is_active") ? 1 : 0;
  await run("UPDATE users SET role_id = ?, is_active = ? WHERE user_id = ?", [
    roleId,
    active,
    userId,
  ]);
  refresh();
  redirect("/admin/users?ok=" + encodeURIComponent("User updated."));
}

export async function updateUsersAction(fd: FormData): Promise<void> {
  const admin = await currentUserOrLogin();
  if (admin.role_id !== 1) redirect("/feed");

  const users = await q<{ user_id: number }>("SELECT user_id FROM users");
  for (const row of users) {
    if (row.user_id === admin.user_id) continue;
    const rawRole = fd.get(`role_${row.user_id}`);
    if (rawRole === null) continue;
    const roleId = Number(rawRole);
    if (![1, 2, 3].includes(roleId)) continue;
    const isActive = fd.get(`active_${row.user_id}`) ? 1 : 0;
    await run("UPDATE users SET role_id = ?, is_active = ? WHERE user_id = ?", [
      roleId,
      isActive,
      row.user_id,
    ]);
  }

  refresh();
  redirect("/admin/users?ok=" + encodeURIComponent("Users updated."));
}

const LOOKUP_CONFIG: Record<
  string,
  { pk: string; fields: string[] }
> = {
  category: { pk: "category_id", fields: ["category_name", "description"] },
  location: {
    pk: "location_id",
    fields: ["location_name", "location_type", "building", "room", "description"],
  },
  department: { pk: "department_id", fields: ["department_name", "department_code"] },
};

export async function saveLookupAction(fd: FormData): Promise<void> {
  const admin = await currentUserOrLogin();
  if (admin.role_id !== 1) redirect("/feed");
  const table = str(fd, "table");
  const config = LOOKUP_CONFIG[table];
  if (!config) redirect("/admin/settings");

  const values = config.fields.map((field) => str(fd, field) || null);
  if (!values[0]) {
    backWith("/admin/settings", "err", "The name field is required.");
  }
  if (table === "location") {
    const type = str(fd, "location_type");
    values[1] = type === "storage" ? "storage" : "found_spot";
  }

  const existingId = int(fd, "id");
  const columns = config.fields.join(", ");
  const placeholders = config.fields.map(() => "?").join(", ");
  try {
    if (existingId) {
      await run(
        `UPDATE ${table} SET ${config.fields.map((f) => `${f} = ?`).join(", ")} WHERE ${config.pk} = ?`,
        [...values, existingId]
      );
    } else {
      await run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values);
    }
  } catch {
    backWith("/admin/settings", "err", "Could not save — the name may already exist.");
  }
  refresh();
  redirect("/admin/settings?ok=" + encodeURIComponent("Saved."));
}

export async function deleteLookupAction(fd: FormData): Promise<void> {
  const admin = await currentUserOrLogin();
  if (admin.role_id !== 1) redirect("/feed");
  const table = str(fd, "table");
  const config = LOOKUP_CONFIG[table];
  const id = int(fd, "id");
  if (!config || !id) redirect("/admin/settings");
  try {
    await run(`DELETE FROM ${table} WHERE ${config.pk} = ?`, [id]);
  } catch {
    backWith("/admin/settings", "err", "That entry is still in use and cannot be deleted.");
  }
  refresh();
  redirect("/admin/settings?ok=" + encodeURIComponent("Deleted."));
}
