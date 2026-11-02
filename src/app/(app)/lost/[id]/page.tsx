import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import Flash from "@/components/Flash";
import LinkedItemCard from "@/components/LinkedItemCard";
import ScrollToHash from "@/components/ScrollToHash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import ThreadReadMarker from "@/components/ThreadReadMarker";
import { closeLostReportAction, postMessageAction, reopenLostReportAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { cx, fmtDate, fmtDateTime, roleLabel, timeAgo } from "@/lib/format";
import { optionalParam, param, type SearchParams } from "@/lib/params";
import {
  getLostPost,
  listAttachableItems,
  listFoundItems,
  listLostMessages,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LostPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const lostReportId = Number(id);
  if (!Number.isInteger(lostReportId) || lostReportId <= 0) notFound();

  const post = await getLostPost(lostReportId);
  if (!post) notFound();

  const preselectedLink = Number(param(sp.link)) || null;
  const [messages, attachable, similar] = await Promise.all([
    listLostMessages(lostReportId),
    listAttachableItems(),
    listFoundItems({
      categoryId: post.category_id,
      onlyActive: true,
      limit: 3,
    }),
  ]);

  const isOwner = post.user_id === user.user_id;
  const isStaff = user.role_id <= 2;
  const isClosed = post.status === "closed";
  const canModerate = isOwner || isStaff;

  let preselectedItem = preselectedLink;
  if (preselectedItem && !attachable.some((item) => item.item_id === preselectedItem)) {
    preselectedItem = null;
  }

  return (
    <div>
      <div className="crumbs">
        <Link href="/feed">← Lost board</Link>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      <div className="detail-grid">
        <div>
          <article className="card post-full">
            <div className="row">
              <div className="grow">
                <div className="btn-row" style={{ marginBottom: "0.5rem" }}>
                  <StatusBadge status={post.status} />
                  <span className="chip">{post.category_name}</span>
                </div>
                <h1>{post.title}</h1>
                <p className="muted small">
                  Posted {fmtDateTime(post.created_at)} · Lost {fmtDate(post.date_lost)}
                </p>
              </div>
              {canModerate ? (
                <form action={isClosed ? reopenLostReportAction : closeLostReportAction}>
                  <input type="hidden" name="lost_report_id" value={post.lost_report_id} />
                  <SubmitButton className="sm" pendingLabel="Saving…">
                    {isClosed ? "Reopen post" : "Mark as resolved"}
                  </SubmitButton>
                </form>
              ) : null}
            </div>

            <div className="owner">
              <Avatar name={post.owner_name} />
              <div>
                <b>{post.owner_name}</b>
                <div className="tiny">
                  {roleLabel(post.owner_role_id)} · owner of this post
                </div>
              </div>
            </div>

            <div className="facts">
              <div className="fact">
                <span>Category</span>
                <b>{post.category_name}</b>
              </div>
              <div className="fact">
                <span>Date lost</span>
                <b>{fmtDate(post.date_lost)}</b>
              </div>
              <div className="fact">
                <span>Last seen</span>
                <b>{post.last_seen_location || "Not specified"}</b>
              </div>
              <div className="fact">
                <span>Replies</span>
                <b>{post.message_count ?? messages.length}</b>
              </div>
            </div>

            {post.description ? <p className="desc">{post.description}</p> : null}
            {post.brand || post.color ? (
              <p className="small muted">
                {post.brand ? `Brand: ${post.brand}` : ""}
                {post.brand && post.color ? " · " : ""}
                {post.color ? `Color: ${post.color}` : ""}
              </p>
            ) : null}

            {!isOwner && !isClosed ? (
              <div className="notice mt2">
                Found this item?{" "}
                <Link href={`/items/new?lost_report_id=${post.lost_report_id}`}>
                  File it as a found item
                </Link>{" "}
                — it will be posted here with a link the owner can open.
              </div>
            ) : null}
            {isClosed ? (
              <div className="notice good mt2">
                This post is closed. The item is back where it belongs (or the
                owner has moved on). You can still read the replies.
              </div>
            ) : null}
          </article>

          <div className="section-title">
            <h2>Conversation</h2>
            <span className="tiny">
              {messages.length} {messages.length === 1 ? "reply" : "replies"} · visible to
              anyone signed in
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="empty">
              <span className="emoji" aria-hidden="true">
                💬
              </span>
              <b>No replies yet</b>
              <div className="small mt1">
                {isOwner
                  ? "When a finder replies, their message — and a link to the item they filed — will appear here."
                  : "Found this item? Reply below and attach the found item you filed."}
              </div>
            </div>
          ) : (
            <div className="thread" id="thread">
              {messages.map((message) => {
                const own = message.sender_id === user.user_id;
                const linked =
                  message.linked_item_id != null ? (
                    <LinkedItemCard
                      itemId={message.linked_item_id}
                      title={message.item_title}
                      code={message.item_code}
                      status={message.item_status}
                      image={message.item_image}
                    />
                  ) : null;

                return (
                  <div
                    className={cx("msg", own && "own")}
                    id={`m${message.message_id}`}
                    key={message.message_id}
                  >
                    <Avatar name={message.sender_name} />
                    <div className="msg-body">
                      <div className="msg-head">
                        <b>{message.sender_name}</b>
                        {message.sender_id === post.user_id ? (
                          <span className="chip">owner</span>
                        ) : null}
                        {(message.sender_role_id ?? 3) <= 2 &&
                        message.sender_id !== post.user_id ? (
                          <span className="chip">staff</span>
                        ) : null}
                        <span className="muted">· {timeAgo(message.created_at)}</span>
                      </div>
                      <div className="bubble">
                        <p>{message.body}</p>
                        {linked}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <ThreadReadMarker lostReportId={post.lost_report_id} />
          <ScrollToHash />

          {isClosed ? null : (
            <div className="card reply-card mt2">
              <h3>Reply to this post</h3>
              <p className="tiny">
                Anyone signed in can reply. If you found the item, file it first, then
                attach it below.
              </p>
              <form action={postMessageAction}>
                <input type="hidden" name="lost_report_id" value={post.lost_report_id} />
                <textarea
                  name="body"
                  rows={3}
                  placeholder={
                    isOwner
                      ? "Add an update for the people following this post…"
                      : "I think I found this! Here is what it looks like…"
                  }
                />
                {attachable.length > 0 ? (
                  <details className="attach">
                    <summary>📎 Attach a found item (optional)</summary>
                    <select
                      name="linked_item_id"
                      defaultValue={preselectedItem ?? ""}
                      aria-label="Attach a found item"
                    >
                      <option value="">— no item —</option>
                      {attachable.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.item_code} · {item.title} · found by {item.finder_name}
                        </option>
                      ))}
                    </select>
                    <p className="tiny" style={{ margin: "0.4rem 0 0" }}>
                      The owner gets a card in this thread that opens the item
                      directly. No need to search the Found items page.
                    </p>
                  </details>
                ) : (
                  <div className="notice mt1">
                    No found items on the board yet.{" "}
                    <Link href={`/items/new?lost_report_id=${post.lost_report_id}`}>
                      File the item you found
                    </Link>
                    .
                  </div>
                )}
                <div className="btn-row mt2">
                  <SubmitButton className="pri" pendingLabel="Posting…">
                    Post reply
                  </SubmitButton>
                  {!isOwner ? (
                    <Link
                      href={`/items/new?lost_report_id=${post.lost_report_id}`}
                      className="btn ghost"
                    >
                      I found this item
                    </Link>
                  ) : null}
                </div>
              </form>
            </div>
          )}
        </div>

        <aside className="detail-side">
          <div className="card flat">
            <h3>About the owner</h3>
            <div className="owner">
              <Avatar name={post.owner_name} />
              <div>
                <b>{post.owner_name}</b>
                <div className="tiny">{roleLabel(post.owner_role_id)}</div>
              </div>
            </div>
            <p className="tiny mt1">
              Replies here notify the owner. Keep personal details out of public
              replies — arrange the hand-over in the item claim.
            </p>
          </div>

          <div className="card flat">
            <h3>Recently found in {post.category_name}</h3>
            {similar.length === 0 ? (
              <p className="small muted mt1">
                Nothing filed in this category yet.{" "}
                <Link href="/items">Browse all found items</Link>.
              </p>
            ) : (
              <div className="list mt1">
                {similar.map((item) => (
                  <LinkedItemCard
                    key={item.item_id}
                    itemId={item.item_id}
                    title={item.title}
                    code={item.item_code}
                    status={item.status}
                    image={item.image}
                    compact
                  />
                ))}
              </div>
            )}
          </div>

          {!isOwner ? (
            <div className="card flat">
              <h3>Found it?</h3>
              <p className="small muted">
                File a found item for everyone to verify, then link it to this
                post so the owner can claim it.
              </p>
              <Link
                href={`/items/new?lost_report_id=${post.lost_report_id}`}
                className="btn pri block mt1"
              >
                File a found item
              </Link>
            </div>
          ) : (
            <div className="card flat">
              <h3>Next step</h3>
              <p className="small muted">
                When a finder replies, open the linked item, check it is yours, and
                submit a claim. Staff or the finder approves it.
              </p>
              <Link href="/items" className="btn block mt1">
                Browse found items
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
