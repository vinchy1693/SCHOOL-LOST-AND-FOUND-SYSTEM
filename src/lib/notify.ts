import { run } from "./db";

export type NotificationType =
  | "item_found"
  | "match_found"
  | "claim_update"
  | "item_returned"
  | "new_message"
  | "general";

interface NotifyTargets {
  itemId?: number | null;
  claimId?: number | null;
  lostId?: number | null;
}

export async function notify(
  userId: number,
  type: NotificationType,
  message: string,
  targets: NotifyTargets = {}
): Promise<void> {
  await run(
    `INSERT INTO notification
       (user_id, notification_type, message, related_item_id, related_claim_id, related_lost_report_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      type,
      message,
      targets.itemId ?? null,
      targets.claimId ?? null,
      targets.lostId ?? null,
    ]
  );
}

export async function notifyMany(
  userIds: Iterable<number>,
  type: NotificationType,
  message: string,
  targets: NotifyTargets = {}
): Promise<void> {
  const unique = new Set<number>();
  for (const id of userIds) {
    if (id) unique.add(id);
  }
  for (const id of unique) {
    await notify(id, type, message, targets);
  }
}
