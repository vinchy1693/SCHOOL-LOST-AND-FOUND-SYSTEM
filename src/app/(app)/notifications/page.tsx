import Link from "next/link";
import Empty from "@/components/Empty";
import SubmitButton from "@/components/SubmitButton";
import { markNotificationsReadAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { listNotifications } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notifications" };

function iconFor(type: string): string {
  switch (type) {
    case "new_message":
      return "💬";
    case "item_found":
      return "📦";
    case "match_found":
      return "🧭";
    case "claim_update":
      return "✅";
    case "item_returned":
      return "🎉";
    default:
      return "🔔";
  }
}

function hrefFor(notification: Notification, staff: boolean): string {
  if (notification.related_claim_id) {
    return staff ? "/dashboard/claims" : "/claims";
  }
  if (notification.related_lost_report_id) {
    return `/lost/${notification.related_lost_report_id}`;
  }
  if (notification.related_item_id) {
    return `/items/${notification.related_item_id}`;
  }
  return "/feed";
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user.user_id);
  const unread = notifications.filter((entry) => entry.is_read === 0).length;
  const staff = user.role_id <= 2;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted">
            Replies, claims and matches that need your attention.
          </p>
        </div>
        {unread > 0 ? (
          <form action={markNotificationsReadAction}>
            <SubmitButton className="sm" pendingLabel="Marking…">
              Mark all read ({unread})
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <Empty emoji="🔔" title="Nothing here yet">
          When someone replies to your post or acts on your claim, it lands here.
        </Empty>
      ) : (
        <div className="list">
          {notifications.map((notification) => (
            <Link
              key={notification.notification_id}
              href={hrefFor(notification, staff)}
              className={`notif${notification.is_read === 0 ? " unread" : ""}`}
            >
              <span className="ico" aria-hidden="true">
                {iconFor(notification.notification_type)}
              </span>
              <span className="tx">
                <p>{notification.message}</p>
                <span className="when">{timeAgo(notification.sent_at)}</span>
              </span>
              <span className="arr" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
