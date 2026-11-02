import Link from "next/link";
import Avatar from "@/components/Avatar";
import Empty from "@/components/Empty";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { excerpt, fmtDate, timeAgo } from "@/lib/format";
import { optionalParam, param, type SearchParams } from "@/lib/params";
import { getMeta, listLostPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lost board" };

export default async function FeedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const sp = await searchParams;

  const search = param(sp.q).trim();
  const categoryId = Number(param(sp.category)) || null;
  const status = param(sp.status);

  const [{ categories }, posts] = await Promise.all([
    getMeta(),
    listLostPosts({
      search: search || undefined,
      categoryId,
      status: status && status !== "all" ? status : null,
      includeClosed: status === "all",
      limit: 60,
    }),
  ]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Lost &amp; Found board</h1>
          <p className="muted">
            Lost something? Post it here. Found something? Reply on the post and
            attach the item you filed — the owner can open it straight from your
            message.
          </p>
        </div>
      </div>

      <div className="cta-grid">
        <Link href="/lost/new" className="cta lost">
          <span className="emoji" aria-hidden="true">
            🧭
          </span>
          <span>
            <b>I lost something</b>
            <span>Post it so finders can reply with what they picked up.</span>
          </span>
        </Link>
        <Link href="/items/new" className="cta found">
          <span className="emoji" aria-hidden="true">
            🙌
          </span>
          <span>
            <b>I found something</b>
            <span>File it, then link it to the owner&apos;s post.</span>
          </span>
        </Link>
      </div>

      <form className="filters" action="/feed" method="get">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search title, brand, color, place…"
          aria-label="Search lost posts"
        />
        <select name="category" defaultValue={categoryId ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.category_name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label="Status">
          <option value="">Active posts</option>
          <option value="open">Open</option>
          <option value="matched">Something turned up</option>
          <option value="closed">Closed</option>
          <option value="all">All posts</option>
        </select>
        <button type="submit" className="btn">
          Filter
        </button>
      </form>

      <div className="post-list">
        {posts.length === 0 ? (
          <Empty
            emoji="📝"
            title="No lost posts match that search"
            action={{ href: "/lost/new", label: "Report a lost item" }}
          >
            Try clearing the filters, or be the first to post about it.
          </Empty>
        ) : (
          posts.map((post) => (
            <article className="post" key={post.lost_report_id}>
              <div className="post-head">
                <Avatar name={post.owner_name} size="sm" />
                <div className="who">
                  <b>{post.owner_name}</b>{" "}
                  <span className="muted">
                    posted a lost item · {timeAgo(post.created_at)}
                  </span>
                </div>
                <StatusBadge status={post.status} />
              </div>

              <Link className="post-title" href={`/lost/${post.lost_report_id}`}>
                {post.title}
              </Link>

              <div className="post-meta">
                <span>{post.category_name}</span>
                <span>Lost {fmtDate(post.date_lost)}</span>
                {post.last_seen_location ? (
                  <span>Last seen: {post.last_seen_location}</span>
                ) : null}
              </div>

              {post.description ? (
                <p className="post-desc">{excerpt(post.description, 190)}</p>
              ) : null}

              <div className="post-foot">
                <span className="replies">
                  💬 {post.message_count ?? 0}{" "}
                  {(post.message_count ?? 0) === 1 ? "reply" : "replies"}
                  {post.last_message_at ? ` · updated ${timeAgo(post.last_message_at)}` : ""}
                </span>
                <Link href={`/lost/${post.lost_report_id}`}>Open post →</Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
