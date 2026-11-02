import Link from "next/link";
import Avatar from "@/components/Avatar";
import Empty from "@/components/Empty";
import { requireUser } from "@/lib/auth";
import { excerpt, timeAgo } from "@/lib/format";
import { listThreads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser();
  const threads = await listThreads(user.user_id);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Messages</h1>
          <p className="muted">
            Every conversation lives on a lost post. Replies include the found item
            that was linked, so you can open it without searching.
          </p>
        </div>
      </div>

      {threads.length === 0 ? (
        <Empty
          emoji="💬"
          title="No conversations yet"
          action={{ href: "/feed", label: "Open the lost board" }}
        >
          Comment on a lost post, or wait for a finder to reply to yours.
        </Empty>
      ) : (
        <div className="list">
          {threads.map((thread) => (
            <Link
              key={`${thread.lost_report_id}-${thread.last_at}`}
              href={`/lost/${thread.lost_report_id}`}
              className={`thread-row${thread.unread > 0 ? " unread" : ""}`}
            >
              <Avatar name={thread.last_sender} />
              <div className="tx">
                <div className="line">
                  <b>{thread.title}</b>
                  {thread.unread > 0 ? (
                    <span className="count">{thread.unread}</span>
                  ) : null}
                </div>
                <div className="preview">
                  {thread.last_sender_id === user.user_id ? "You: " : `${thread.last_sender}: `}
                  {excerpt(thread.last_body, 110)}
                </div>
                <div className="sub">
                  {thread.category_name} · {thread.message_count}{" "}
                  {thread.message_count === 1 ? "message" : "messages"} · owner{" "}
                  {thread.owner_name}
                </div>
              </div>
              <span className="muted tiny nowrap">{timeAgo(thread.last_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
