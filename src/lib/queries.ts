import { q, q1 } from "./db";
import type {
  Category,
  Claim,
  ClaimEvidence,
  Department,
  HistoryRow,
  Item,
  ItemImage,
  Location,
  LostReport,
  Notification,
  PostMessage,
  Thread,
  User,
} from "./types";

const ITEM_SELECT = `
  SELECT i.*, c.category_name,
         COALESCE(NULLIF(i.found_location_text, ''), fl.location_name) AS found_location,
         sl.location_name AS storage_location,
         u.full_name AS finder_name, u.email AS finder_email, u.role_id AS finder_role_id,
         (SELECT img.file_path FROM item_image img
           WHERE img.item_id = i.item_id
           ORDER BY img.is_primary DESC, img.item_image_id ASC LIMIT 1) AS image,
         (SELECT COUNT(*) FROM claim cl
           WHERE cl.item_id = i.item_id AND cl.claim_status = 'pending') AS pending_claims,
         lr.title AS response_lost_title, lr.lost_report_id AS response_lost_id
  FROM item i
  JOIN category c ON c.category_id = i.category_id
  JOIN users u ON u.user_id = i.reported_by
  LEFT JOIN location fl ON fl.location_id = i.found_location_id
  LEFT JOIN location sl ON sl.location_id = i.storage_location_id
  LEFT JOIN lost_report lr ON lr.lost_report_id = i.response_to_lost_report_id`;

const LOST_SELECT = `
  SELECT r.*, c.category_name, u.full_name AS owner_name, u.email AS owner_email, u.role_id AS owner_role_id,
         (SELECT COUNT(*) FROM post_message pm WHERE pm.lost_report_id = r.lost_report_id) AS message_count,
         (SELECT MAX(pm.created_at) FROM post_message pm WHERE pm.lost_report_id = r.lost_report_id) AS last_message_at
  FROM lost_report r
  JOIN category c ON c.category_id = r.category_id
  JOIN users u ON u.user_id = r.user_id`;

const CLAIM_SELECT = `
  SELECT cl.*, i.item_code, i.title AS item_title, i.status AS item_status,
         i.is_valuable AS item_is_valuable, i.reported_by AS finder_id,
         claimant.full_name AS claimant_name, claimant.email AS claimant_email,
         claimant.phone AS claimant_phone, claimant.id_number AS claimant_id_number,
         finder.full_name AS finder_name,
         ret.received_by_name, ret.returned_at
  FROM claim cl
  JOIN item i ON i.item_id = cl.item_id
  JOIN users claimant ON claimant.user_id = cl.claimant_id
  JOIN users finder ON finder.user_id = i.reported_by
  LEFT JOIN item_return ret ON ret.claim_id = cl.claim_id`;

export async function getMeta(): Promise<{
  categories: Category[];
  locations: Location[];
  departments: Department[];
}> {
  const [categories, locations, departments] = await Promise.all([
    q<Category>("SELECT * FROM category ORDER BY category_name"),
    q<Location>("SELECT * FROM location ORDER BY location_type, location_name"),
    q<Department>("SELECT * FROM department ORDER BY department_name"),
  ]);
  return { categories, locations, departments };
}

interface ItemFilters {
  search?: string;
  categoryId?: number | null;
  status?: string | null;
  reportedBy?: number | null;
  onlyActive?: boolean;
  limit?: number;
}

export async function listFoundItems(filters: ItemFilters = {}): Promise<Item[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.onlyActive) {
    where.push("i.status IN ('found', 'in_storage')");
  } else if (filters.status) {
    where.push("i.status = ?");
    params.push(filters.status);
  }
  if (filters.categoryId) {
    where.push("i.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.reportedBy) {
    where.push("i.reported_by = ?");
    params.push(filters.reportedBy);
  }
  if (filters.search) {
    where.push(`(i.title LIKE ? OR i.description LIKE ? OR i.brand LIKE ? OR i.color LIKE ?
                 OR i.item_code LIKE ? OR i.found_location_text LIKE ?)`);
    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like, like);
  }

  const sql =
    ITEM_SELECT +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY i.created_at DESC, i.item_id DESC LIMIT ${Number(filters.limit) || 100}`;
  return q<Item>(sql, params);
}

export async function getFoundItem(itemId: number): Promise<Item | null> {
  return q1<Item>(ITEM_SELECT + " WHERE i.item_id = ?", [itemId]);
}

export async function getItemImages(itemId: number): Promise<ItemImage[]> {
  return q<ItemImage>(
    "SELECT * FROM item_image WHERE item_id = ? ORDER BY is_primary DESC, item_image_id ASC",
    [itemId]
  );
}

export async function getItemHistory(itemId: number): Promise<HistoryRow[]> {
  return q<HistoryRow>(
    `SELECT h.*, u.full_name FROM item_status_history h
     JOIN users u ON u.user_id = h.changed_by
     WHERE h.item_id = ?
     ORDER BY h.changed_at DESC, h.item_status_history_id DESC`,
    [itemId]
  );
}

export async function getItemClaims(itemId: number): Promise<Claim[]> {
  const claims = await q<Claim>(
    CLAIM_SELECT + " WHERE cl.item_id = ? ORDER BY FIELD(cl.claim_status,'pending','approved','rejected'), cl.created_at DESC",
    [itemId]
  );
  return attachEvidence(claims);
}

export async function getClaimForUser(itemId: number, userId: number): Promise<Claim | null> {
  return q1<Claim>(
    CLAIM_SELECT +
      " WHERE cl.item_id = ? AND cl.claimant_id = ? AND cl.claim_status IN ('pending','approved') LIMIT 1",
    [itemId, userId]
  );
}

async function attachEvidence(claims: Claim[]): Promise<Claim[]> {
  if (!claims.length) return claims;
  const ids = claims.map((c) => c.claim_id);
  const evidence = await q<ClaimEvidence>(
    `SELECT * FROM claim_evidence WHERE claim_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  const byClaim = new Map<number, ClaimEvidence[]>();
  for (const row of evidence) {
    const list = byClaim.get(row.claim_id) ?? [];
    list.push(row);
    byClaim.set(row.claim_id, list);
  }
  return claims.map((c) => ({ ...c, evidence: byClaim.get(c.claim_id) ?? [] }));
}

export async function listMyLostReports(userId: number): Promise<LostReport[]> {
  return q<LostReport>(
    LOST_SELECT + " WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 100",
    [userId]
  );
}

export async function listLostPosts(filters: {
  search?: string;
  categoryId?: number | null;
  status?: string | null;
  ownerId?: number | null;
  includeClosed?: boolean;
  limit?: number;
} = {}): Promise<LostReport[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.ownerId) {
    where.push("r.user_id = ?");
    params.push(filters.ownerId);
  }
  if (filters.status) {
    where.push("r.status = ?");
    params.push(filters.status);
  } else if (!filters.includeClosed) {
    where.push("r.status IN ('open', 'matched')");
  }
  if (filters.categoryId) {
    where.push("r.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.search) {
    where.push("(r.title LIKE ? OR r.description LIKE ? OR r.brand LIKE ? OR r.color LIKE ? OR r.last_seen_location LIKE ?)");
    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like);
  }

  const sql =
    LOST_SELECT +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY r.created_at DESC LIMIT ${Number(filters.limit) || 60}`;
  return q<LostReport>(sql, params);
}

export async function getLostPost(lostReportId: number): Promise<LostReport | null> {
  return q1<LostReport>(LOST_SELECT + " WHERE r.lost_report_id = ?", [lostReportId]);
}

export async function listLostMessages(lostReportId: number): Promise<PostMessage[]> {
  return q<PostMessage>(
    `SELECT m.*, u.full_name AS sender_name, u.role_id AS sender_role_id,
            i.item_code, i.title AS item_title, i.status AS item_status,
            (SELECT img.file_path FROM item_image img
              WHERE img.item_id = m.linked_item_id
              ORDER BY img.is_primary DESC, img.item_image_id ASC LIMIT 1) AS item_image
     FROM post_message m
     JOIN users u ON u.user_id = m.sender_id
     LEFT JOIN item i ON i.item_id = m.linked_item_id
     WHERE m.lost_report_id = ?
     ORDER BY m.created_at ASC, m.message_id ASC`,
    [lostReportId]
  );
}

export async function listThreads(userId: number): Promise<Thread[]> {
  return q<Thread>(
    `SELECT r.lost_report_id, r.title, r.status, c.category_name,
            owner.full_name AS owner_name, owner.user_id AS owner_id,
            lm.body AS last_body, lm.created_at AS last_at,
            sender.full_name AS last_sender, sender.user_id AS last_sender_id,
            (SELECT COUNT(*) FROM post_message x WHERE x.lost_report_id = r.lost_report_id) AS message_count,
            (SELECT COUNT(*) FROM post_message m2
              WHERE m2.lost_report_id = r.lost_report_id AND m2.sender_id <> ?
                AND (rr.last_read_at IS NULL OR m2.created_at > rr.last_read_at)) AS unread
     FROM lost_report r
     JOIN category c ON c.category_id = r.category_id
     JOIN users owner ON owner.user_id = r.user_id
     JOIN post_message lm ON lm.message_id =
          (SELECT MAX(message_id) FROM post_message WHERE lost_report_id = r.lost_report_id)
     JOIN users sender ON sender.user_id = lm.sender_id
     LEFT JOIN lost_report_read rr ON rr.lost_report_id = r.lost_report_id AND rr.user_id = ?
     WHERE r.user_id = ?
        OR EXISTS (SELECT 1 FROM post_message p WHERE p.lost_report_id = r.lost_report_id AND p.sender_id = ?)
     ORDER BY lm.created_at DESC, lm.message_id DESC
     LIMIT 50`,
    [userId, userId, userId, userId]
  );
}

export async function getUnreadMessageCount(userId: number): Promise<number> {
  const row = await q1<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM post_message m
     JOIN lost_report r ON r.lost_report_id = m.lost_report_id
     LEFT JOIN lost_report_read rr ON rr.lost_report_id = m.lost_report_id AND rr.user_id = ?
     WHERE m.sender_id <> ?
       AND (r.user_id = ? OR EXISTS (
             SELECT 1 FROM post_message p WHERE p.lost_report_id = m.lost_report_id AND p.sender_id = ?))
       AND (rr.last_read_at IS NULL OR m.created_at > rr.last_read_at)`,
    [userId, userId, userId, userId]
  );
  return Number(row?.n ?? 0);
}

export async function listClaims(filters: {
  userId?: number;
  finderId?: number;
  status?: string | null;
  limit?: number;
} = {}): Promise<Claim[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.userId) {
    where.push("cl.claimant_id = ?");
    params.push(filters.userId);
  }
  if (filters.finderId) {
    where.push("i.reported_by = ?");
    params.push(filters.finderId);
  }
  if (filters.status) {
    where.push("cl.claim_status = ?");
    params.push(filters.status);
  }
  const sql =
    CLAIM_SELECT +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY FIELD(cl.claim_status,'pending','approved','rejected'), cl.created_at DESC
      LIMIT ${Number(filters.limit) || 200}`;
  const rows = await q<Claim>(sql, params);
  return attachEvidence(rows);
}

export async function getPendingClaimCount(): Promise<number> {
  const row = await q1<{ n: number }>("SELECT COUNT(*) AS n FROM claim WHERE claim_status = 'pending'");
  return Number(row?.n ?? 0);
}

export async function listNotifications(userId: number): Promise<Notification[]> {
  return q<Notification>(
    "SELECT * FROM notification WHERE user_id = ? ORDER BY sent_at DESC, notification_id DESC LIMIT 100",
    [userId]
  );
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const row = await q1<{ n: number }>(
    "SELECT COUNT(*) AS n FROM notification WHERE user_id = ? AND is_read = 0",
    [userId]
  );
  return Number(row?.n ?? 0);
}

export async function getStats() {
  const [byStatus, pending, awaiting, openReports, users, recent] = await Promise.all([
    q<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM item GROUP BY status"),
    q1<{ n: number }>("SELECT COUNT(*) AS n FROM claim WHERE claim_status = 'pending'"),
    q1<{ n: number }>(
      `SELECT COUNT(*) AS n FROM claim cl
       LEFT JOIN item_return r ON r.claim_id = cl.claim_id
       WHERE cl.claim_status = 'approved' AND r.claim_id IS NULL`
    ),
    q1<{ n: number }>("SELECT COUNT(*) AS n FROM lost_report WHERE status <> 'closed'"),
    q1<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE is_active = 1"),
    q<{
      new_status: string;
      changed_at: string;
      title: string;
      item_code: string;
      full_name: string;
    }>(
      `SELECT h.new_status, h.changed_at, i.title, i.item_code, u.full_name
       FROM item_status_history h
       JOIN item i ON i.item_id = h.item_id
       JOIN users u ON u.user_id = h.changed_by
       ORDER BY h.changed_at DESC, h.item_status_history_id DESC LIMIT 8`
    ),
  ]);

  const items: Record<string, number> = {};
  for (const row of byStatus) items[row.status] = Number(row.n);

  return {
    items,
    pendingClaims: Number(pending?.n ?? 0),
    awaitingRelease: Number(awaiting?.n ?? 0),
    openReports: Number(openReports?.n ?? 0),
    users: Number(users?.n ?? 0),
    recent,
  };
}

export async function listAdminUsers(): Promise<User[]> {
  return q<User>(
    `SELECT u.user_id, u.full_name, u.email, u.id_number, u.user_type, u.role_id,
            u.is_active, u.created_at, d.department_code, d.department_name
     FROM users u
     LEFT JOIN department d ON d.department_id = u.department_id
     ORDER BY u.created_at DESC`
  );
}

export async function listOpenLostReports(limit = 100): Promise<LostReport[]> {
  return q<LostReport>(
    LOST_SELECT + " WHERE r.status <> 'closed' ORDER BY r.created_at DESC LIMIT ?",
    [limit]
  );
}

export async function listAttachableItems(limit = 100): Promise<Item[]> {
  return q<Item>(
    ITEM_SELECT +
      " WHERE i.status IN ('found', 'in_storage') ORDER BY i.created_at DESC LIMIT ?",
    [limit]
  );
}

export interface SuggestedMatch {
  item_id: number;
  item_code: string;
  title: string;
  category_name: string;
  color: string | null;
  brand: string | null;
  date_found: string;
  found_location: string | null;
  image: string | null;
  score: number;
  match_status: string | null;
}

export async function getSuggestedMatches(lostReportId: number): Promise<SuggestedMatch[]> {
  const report = await q1<LostReport>(
    "SELECT * FROM lost_report WHERE lost_report_id = ?",
    [lostReportId]
  );
  if (!report) return [];

  const candidates = await q<Item>(
    ITEM_SELECT +
      " WHERE i.status IN ('found', 'in_storage') AND i.date_found >= ?",
    [report.date_lost]
  );
  const existing = await q<{ item_id: number; match_status: string }>(
    "SELECT item_id, match_status FROM item_match WHERE lost_report_id = ?",
    [lostReportId]
  );
  const matchStatus = new Map(existing.map((m) => [m.item_id, m.match_status]));

  const words = `${report.title} ${report.description ?? ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  const scored: SuggestedMatch[] = [];
  for (const item of candidates) {
    let score = 0;
    if (item.category_id === report.category_id) score += 40;
    if (report.color && item.color && report.color.toLowerCase() === item.color.toLowerCase()) {
      score += 20;
    }
    if (report.brand && item.brand && report.brand.toLowerCase() === item.brand.toLowerCase()) {
      score += 20;
    }
    const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
    const hits = words.filter((w) => haystack.includes(w)).length;
    if (words.length) score += Math.min(20, Math.round((20 * hits) / words.length));

    if (score >= 40) {
      scored.push({
        item_id: item.item_id,
        item_code: item.item_code,
        title: item.title,
        category_name: item.category_name ?? "",
        color: item.color,
        brand: item.brand,
        date_found: item.date_found,
        found_location: item.found_location ?? null,
        image: item.image ?? null,
        score,
        match_status: matchStatus.get(item.item_id) ?? null,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}
