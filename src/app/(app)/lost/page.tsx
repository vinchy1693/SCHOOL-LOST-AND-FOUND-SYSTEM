import Link from "next/link";
import Empty from "@/components/Empty";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { excerpt, fmtDate, timeAgo } from "@/lib/format";
import { optionalParam, type SearchParams } from "@/lib/params";
import { listMyLostReports } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "My lost posts" };

export default async function MyLostPostsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const posts = await listMyLostReports(user.user_id);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My lost posts</h1>
          <p className="muted">
            Everything you have posted. Replies from finders land on the post and
            in your messages.
          </p>
        </div>
        <Link href="/lost/new" className="btn pri">
          ＋ Report a lost item
        </Link>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      {posts.length === 0 ? (
        <Empty
          emoji="📝"
          title="You have not posted a lost item yet"
          action={{ href: "/lost/new", label: "Report a lost item" }}
        >
          Post it on the board and let finders reply with what they picked up.
        </Empty>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <article className="post" key={post.lost_report_id}>
              <div className="post-head">
                <div className="who">
                  <span className="muted">
                    Posted {timeAgo(post.created_at)} · {post.category_name}
                  </span>
                </div>
                <StatusBadge status={post.status} />
              </div>

              <Link className="post-title" href={`/lost/${post.lost_report_id}`}>
                {post.title}
              </Link>

              <div className="post-meta">
                <span>Lost {fmtDate(post.date_lost)}</span>
                {post.last_seen_location ? (
                  <span>Last seen: {post.last_seen_location}</span>
                ) : null}
              </div>

              {post.description ? (
                <p className="post-desc">{excerpt(post.description, 160)}</p>
              ) : null}

              <div className="post-foot">
                <span className="replies">
                  💬 {post.message_count ?? 0}{" "}
                  {(post.message_count ?? 0) === 1 ? "reply" : "replies"}
                </span>
                <Link href={`/lost/${post.lost_report_id}`}>Open post →</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
