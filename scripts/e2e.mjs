/**
 * End-to-end check of the two-sided flow, using the installed Edge browser.
 *
 *   npm run e2e
 *
 * Owner (Alex) posts a lost item -> Finder (Jamie) files the found item from
 * the post -> the reply carries a link to the item -> Alex claims it -> Jamie
 * approves and hands it over -> the post closes.
 */
import { chromium } from "playwright-core";
import mysql from "mysql2/promise";
import zlib from "node:zlib";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.APP_URL || "http://localhost:3000";
const SHOTS = path.join(process.cwd(), "test-results", "screens");
const LOST_TITLE = "Blue Hydro Flask tumbler";
const ITEM_TITLE = "Blue Hydro Flask with a cat sticker";

// A readable blue gradient so cards and detail pages have a real photo in the
// screenshots. (A 1x1 transparent PNG would look like an empty box.)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function makePng(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const t = y / height;
      raw[offset++] = Math.round(22 + 28 * t);
      raw[offset++] = Math.round(118 + 42 * t);
      raw[offset++] = Math.round(192 - 18 * t);
    }
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG = makePng(640, 400);

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function cleanupPreviousRun() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "lost_and_found_db",
  });
  const [reports] = await conn.query(
    "SELECT lost_report_id FROM lost_report WHERE title IN (?)",
    [[LOST_TITLE]]
  );
  const [items] = await conn.query("SELECT item_id FROM item WHERE title IN (?)", [
    [ITEM_TITLE],
  ]);
  const reportIds = reports.map((r) => r.lost_report_id);
  const itemIds = items.map((i) => i.item_id);

  if (reportIds.length || itemIds.length) {
    const reportsIn = reportIds.length ? reportIds : [0];
    const itemsIn = itemIds.length ? itemIds : [0];
    const [claims] = await conn.query(
      "SELECT claim_id FROM claim WHERE item_id IN (?) OR lost_report_id IN (?)",
      [itemsIn, reportsIn]
    );
    const claimIds = claims.length ? claims.map((c) => c.claim_id) : [0];
    await conn.query(
      "DELETE FROM notification WHERE related_item_id IN (?) OR related_lost_report_id IN (?) OR related_claim_id IN (?)",
      [itemsIn, reportsIn, claimIds]
    );
    await conn.query(
      "DELETE FROM post_message WHERE lost_report_id IN (?) OR linked_item_id IN (?)",
      [reportsIn, itemsIn]
    );
    await conn.query("DELETE FROM item_return WHERE claim_id IN (?)", [claimIds]);
    await conn.query("DELETE FROM claim_evidence WHERE claim_id IN (?)", [claimIds]);
    await conn.query("DELETE FROM claim WHERE claim_id IN (?)", [claimIds]);
    await conn.query(
      "DELETE FROM item_match WHERE lost_report_id IN (?) OR item_id IN (?)",
      [reportsIn, itemsIn]
    );
    await conn.query("DELETE FROM item_status_history WHERE item_id IN (?)", [itemsIn]);
    await conn.query("DELETE FROM item_image WHERE item_id IN (?)", [itemsIn]);
    await conn.query("DELETE FROM disposal WHERE item_id IN (?)", [itemsIn]);
    await conn.query("DELETE FROM item WHERE item_id IN (?)", [itemsIn]);
    await conn.query("DELETE FROM lost_report WHERE lost_report_id IN (?)", [reportsIn]);
    console.log("  · cleaned a previous test run");
  }
  await conn.end();
}

async function login(context, email, password) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL(/\/(feed|dashboard)$/),
    page.locator('button[type="submit"]').click(),
  ]);
  return page;
}

async function flash(page) {
  await page.waitForSelector(".flash");
  return (await page.locator(".flash").first().innerText()).trim();
}

async function waitForFlashText(page, pattern) {
  await page.waitForFunction(
    (source) => {
      const element = document.querySelector(".flash");
      return !!element && new RegExp(source, "i").test(element.textContent || "");
    },
    pattern.source,
    { timeout: 15000 }
  );
}

async function shot(page, name) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  // Sticky columns are drawn at the scroll position in full-page captures.
  await page.addStyleTag({
    content: ".side, .detail-side { position: static !important; }",
  });
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
  console.log(`  · screenshot ${name}`);
}

await mkdir(SHOTS, { recursive: true });
await cleanupPreviousRun();

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  // ---------------------------------------------------------------- owner
  console.log("\n1. Owner posts a lost item");
  const alexCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const alex = await login(alexCtx, "alex@demo.local", "demo1234");
  assert(alex.url().endsWith("/feed"), "Alex lands on the lost board");

  await alex.goto(`${BASE}/lost/new`);
  await alex.fill("#title", LOST_TITLE);
  await alex.selectOption("#category_id", { label: "Tumbler" });
  await alex.fill("#brand", "Hydro Flask");
  await alex.fill("#color", "blue");
  await alex.fill("#last_seen_location", "CL4");
  await alex.fill(
    "#description",
    "Blue tumbler with a cat sticker on the side and a small dent on the lid. My name is written under the sticker."
  );
  await alex.locator('button:has-text("Post lost item")').click();
  await alex.waitForURL(/\/lost\/\d+/);
  const lostId = Number(alex.url().match(/\/lost\/(\d+)/)[1]);
  const lostFlash = await flash(alex);
  assert(lostFlash.includes("posted"), "lost item is posted with a confirmation");
  assert(
    (await alex.locator("h1").innerText()).includes(LOST_TITLE),
    "the post page shows the lost item"
  );
  await shot(alex, "01-lost-post.png");

  // --------------------------------------------------------------- finder
  console.log("\n2. Finder opens the post and files the found item");
  const jamieCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const jamie = await login(jamieCtx, "jamie@demo.local", "demo1234");
  await jamie.goto(`${BASE}/feed`);
  assert(
    (await jamie.locator(".post").filter({ hasText: LOST_TITLE }).count()) === 1,
    "the post is visible on the board"
  );
  await jamie.locator(".post").filter({ hasText: LOST_TITLE }).locator(".post-title").click();
  await jamie.waitForURL(new RegExp(`/lost/${lostId}`));

  await jamie.getByRole("link", { name: /I found this item/i }).first().click();
  await jamie.waitForURL(new RegExp(`/items/new\\?lost_report_id=${lostId}`));
  assert(
    (await jamie.locator(".notice").innerText()).includes(LOST_TITLE),
    "the found-item form is pre-linked to the lost post"
  );

  await jamie.fill("#title", ITEM_TITLE);
  await jamie.selectOption("#category_id", { label: "Tumbler" });
  await jamie.fill("#found_location", "CL4, under the front desk");
  await jamie.fill("#brand", "Hydro Flask");
  await jamie.fill("#color", "blue");
  await jamie.fill(
    "#description",
    "Blue flask with a cat sticker and a small dent on the lid."
  );
  await jamie.setInputFiles("#image", {
    name: "flask.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await jamie.fill("#note", "Found it after class — it is with me at the guard house.");
  await jamie.locator('button:has-text("File found item")').click();
  await jamie.waitForURL(/\/items\/\d+/);
  const itemId = Number(jamie.url().match(/\/items\/(\d+)/)[1]);
  const itemFlash = await flash(jamie);
  assert(itemFlash.includes("posted to the lost-item thread"), "item filed and linked");
  assert(
    (await jamie.locator(".card").filter({ hasText: "Linked to a lost post" }).count()) === 1,
    "the item shows the linked lost post"
  );
  const photoSrc = await jamie.locator(".item-photo img").getAttribute("src");
  assert(!!photoSrc && photoSrc.startsWith("/uploads/"), "the photo was saved");
  const photoResponse = await jamie.request.get(`${BASE}${photoSrc}`);
  assert(photoResponse.status() === 200, "the uploaded photo is served back");

  // --------------------------------------------------- the linked message
  console.log("\n3. Owner gets a message with the item linked");
  await alex.goto(`${BASE}/messages`);
  assert(
    (await alex.locator(".thread-row").filter({ hasText: LOST_TITLE }).count()) === 1,
    "the thread appears in Messages"
  );
  await shot(alex, "02-messages.png");
  await alex.locator(".thread-row").filter({ hasText: LOST_TITLE }).click();
  await alex.waitForURL(new RegExp(`/lost/${lostId}`));
  const bubble = alex.locator(".msg").filter({ hasText: "Found it after class" }).first();
  assert((await bubble.count()) === 1, "the finder's reply is on the post");
  assert(
    (await bubble.locator(".itemlink").innerText()).includes(ITEM_TITLE),
    "the reply carries a card for the found item"
  );
  await shot(alex, "03-thread-with-item-link.png");

  await bubble.locator(".itemlink").click();
  await alex.waitForURL(new RegExp(`/items/${itemId}$`));
  assert(
    (await alex.locator("h1").innerText()).includes(ITEM_TITLE),
    "clicking the card opens the item directly"
  );

  // ---------------------------------------------------------------- claim
  console.log("\n4. Owner claims the item");
  await alex.fill(
    "#description_provided",
    "It has a cat sticker and a dented lid; my name is written under the sticker."
  );
  await alex.selectOption("#evidence_type", "serial_number");
  await alex.fill("#evidence_details", "Hydro Flask serial HF-8842");
  await alex.locator('button:has-text("Submit claim")').click();
  await alex.waitForSelector(".flash.ok");
  assert((await flash(alex)).includes("Claim submitted"), "claim submitted");
  assert(
    (await alex.locator(".card").filter({ hasText: "Your claim" }).count()) >= 1,
    "the owner sees their pending claim"
  );

  // ------------------------------------------------- review and hand-over
  console.log("\n5. Finder approves the claim and hands the item over");
  await jamie.goto(`${BASE}/items/${itemId}`);
  const claimCard = jamie.locator(".claim").filter({ hasText: "Alex Rivera" }).first();
  assert((await claimCard.count()) === 1, "the finder sees the claim");
  await claimCard.locator('button:has-text("Approve claim")').click();
  await jamie.waitForSelector(".flash.ok");
  assert((await flash(jamie)).includes("approved"), "the finder can approve the claim");
  await shot(jamie, "04-claim-approved.png");

  await jamie.fill('input[name="received_by_name"]', "Alex Rivera");
  await jamie.fill('input[name="id_presented"]', "School ID 2026-0001");
  await jamie.locator('button:has-text("Mark as handed over")').click();
  await waitForFlashText(jamie, /returned/i);
  assert((await flash(jamie)).includes("returned"), "the item is marked returned");
  assert(
    (await jamie.locator(".badge").filter({ hasText: "Returned" }).count()) >= 1,
    "the item badge shows Returned"
  );

  await jamie.goto(`${BASE}/lost/${lostId}`);
  assert(
    (await jamie.locator(".notice").filter({ hasText: "post is closed" }).count()) === 1,
    "the lost post is closed after the hand-over"
  );
  await shot(jamie, "05-returned-post.png");

  // ---------------------------------------------- attach an existing item
  console.log("\n5b. Attaching an existing item to a reply");
  await jamie.goto(`${BASE}/feed?q=Jansport`);
  const navyPost = jamie.locator(".post").filter({ hasText: "Navy Jansport backpack" }).first();
  assert((await navyPost.count()) === 1, "the seeded backpack post is on the board");
  await navyPost.locator(".post-title").click();
  await jamie.waitForURL(/\/lost\/\d+/);

  const attachValue = await jamie
    .locator('select[name="linked_item_id"] option')
    .filter({ hasText: "Navy backpack left near the library" })
    .getAttribute("value");
  assert(!!attachValue, "the reply form lists existing found items");
  await jamie.locator("details.attach").evaluate((element) => {
    element.open = true;
  });
  await jamie.fill(
    'textarea[name="body"]',
    "I think this is the backpack I filed — linking it here so you can open it."
  );
  await jamie.selectOption('select[name="linked_item_id"]', attachValue);
  await jamie.locator('button:has-text("Post reply")').click();
  await waitForFlashText(jamie, /Reply posted/);
  const lastBubble = jamie.locator(".msg").last();
  assert(
    (await lastBubble.innerText()).includes("Navy backpack left near the library"),
    "the reply shows the attached item card"
  );
  await shot(jamie, "08-attached-existing-item.png");

  // --------------------------------------------------------- notifications
  console.log("\n6. Owner is notified");
  await alex.goto(`${BASE}/notifications`);
  await alex.waitForSelector(".notif");
  const notifications = await alex.locator(".notif").allInnerTexts();
  assert(
    notifications.some((text) => /handed over|approved/i.test(text)),
    "the owner has a claim notification"
  );

  // --------------------------------------------------------------- staff
  console.log("\n7. Staff dashboard and claim queue");
  const staffCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const staff = await login(staffCtx, "staff@demo.local", "demo1234");
  assert(staff.url().endsWith("/dashboard"), "staff lands on the dashboard");
  await staff.waitForSelector(".stat");
  await shot(staff, "06-dashboard.png");
  await staff.goto(`${BASE}/dashboard/claims`);
  assert(
    (await staff.locator("h1").innerText()).includes("Claim queue"),
    "the staff claim queue loads"
  );
  await staff.goto(`${BASE}/dashboard/reports`);
  assert(
    (await staff.locator(".post-title, h3").filter({ hasText: "Casio" }).count()) >= 1 ||
      (await staff.locator("body").innerText()).includes("Casio"),
    "staff see the lost reports and matching tool"
  );

  // --------------------------------------------------------------- admin
  console.log("\n8. Admin pages");
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const admin = await login(adminCtx, "admin@school.edu", "admin123");
  await admin.goto(`${BASE}/admin/users`);
  assert(
    (await admin.locator("h1").innerText()).includes("Users"),
    "admin users page loads"
  );
  await shot(admin, "07-admin-users.png");
  await admin.goto(`${BASE}/admin/settings`);
  assert(
    (await admin.locator("body").innerText()).includes("Categories"),
    "admin settings page loads"
  );

  console.log(`\nAll checks passed.\n  lost report #${lostId}, found item #${itemId}`);
  console.log(`  screenshots: ${SHOTS}\n`);
} catch (err) {
  console.error("\nE2E FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
