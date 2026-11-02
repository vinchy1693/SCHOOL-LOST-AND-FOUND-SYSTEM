import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import {
  claimItemAction,
  disposeItemAction,
  linkItemToLostReportAction,
  releaseItemAction,
  reviewClaimAction,
  updateStorageAction,
} from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, roleLabel, statusLabel, timeAgo } from "@/lib/format";
import { optionalParam, type SearchParams } from "@/lib/params";
import {
  getClaimForUser,
  getFoundItem,
  getItemClaims,
  getItemHistory,
  getMeta,
  listMyLostReports,
  listOpenLostReports,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  const item = await getFoundItem(itemId);
  if (!item) notFound();

  const isFinder = item.reported_by === user.user_id;
  const staff = user.role_id <= 2;
  const canManage = isFinder || staff;
  const active = ["found", "in_storage"].includes(item.status);
  const canSeeDetails = canManage || Number(item.is_valuable) === 0;

  const [meta, claims, history, myClaim, myReports, openReports] = await Promise.all([
    getMeta(),
    canManage ? getItemClaims(itemId) : Promise.resolve([]),
    staff ? getItemHistory(itemId) : Promise.resolve([]),
    canManage ? Promise.resolve(null) : getClaimForUser(itemId, user.user_id),
    active && !isFinder ? listMyLostReports(user.user_id) : Promise.resolve([]),
    canManage && !item.response_to_lost_report_id
      ? listOpenLostReports(50)
      : Promise.resolve([]),
  ]);

  const storageLocations = meta.locations.filter(
    (location) => location.location_type === "storage"
  );
  const defaultLostReport =
    myReports.find((report) => report.lost_report_id === item.response_lost_id)?.lost_report_id ??
    myReports.find((report) => report.status !== "closed")?.lost_report_id ??
    "";

  return (
    <div>
      <div className="crumbs">
        <Link href={canManage ? "/items?mine=1" : "/items"}>← Found items</Link>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      <div className="detail-grid">
        <div>
          <article className="card">
            <div className="item-photo">
              {item.image ? <img src={item.image} alt={item.title} /> : "📦"}
            </div>

            <div className="detail-head">
              <div>
                <div className="btn-row" style={{ marginBottom: "0.4rem" }}>
                  <StatusBadge status={item.status} />
                  <span className="chip">{item.category_name}</span>
                  {Number(item.is_valuable) === 1 ? (
                    <span className="chip">⭐ valuable</span>
                  ) : null}
                  {canManage && Number(item.pending_claims) > 0 ? (
                    <span className="chip">
                      {item.pending_claims} pending claim
                      {Number(item.pending_claims) === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                <h1>{item.title}</h1>
                <p className="muted small">
                  {item.item_code} · filed {timeAgo(item.created_at)}
                </p>
              </div>
            </div>

            <div className="facts-grid">
              <div className="fact">
                <span>Found on</span>
                <b>{fmtDate(item.date_found)}</b>
              </div>
              <div className="fact">
                <span>Found at</span>
                <b>{item.found_location || "Not specified"}</b>
              </div>
              <div className="fact">
                <span>Held</span>
                <b>
                  {item.storage_location
                    ? `Office — ${item.storage_location}`
                    : `With ${item.finder_name}`}
                </b>
              </div>
              <div className="fact">
                <span>Reported by</span>
                <b>{item.finder_name}</b>
              </div>
            </div>

            {canSeeDetails ? (
              <>
                {item.description ? <p className="desc">{item.description}</p> : null}
                {item.brand || item.color ? (
                  <p className="small muted">
                    {item.brand ? `Brand: ${item.brand}` : ""}
                    {item.brand && item.color ? " · " : ""}
                    {item.color ? `Color: ${item.color}` : ""}
                  </p>
                ) : null}
                {staff && item.found_id_number ? (
                  <p className="small">
                    <b>ID number printed on item:</b> {item.found_id_number}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="notice warn">
                Identifying details for this item are hidden. Describe it in your
                claim — the finder or staff will verify it.
              </div>
            )}
          </article>

          {item.response_lost_id ? (
            <div className="card mt2">
              <h3>Linked to a lost post</h3>
              <p className="small muted">
                This item was filed in reply to “{item.response_lost_title}”. The
                owner was notified with a link to this page.
              </p>
              <Link href={`/lost/${item.response_lost_id}`} className="btn sm mt1">
                Open the conversation
              </Link>
            </div>
          ) : null}

          {canManage ? (
            <>
              <div className="section-title">
                <h2>Claims on this item</h2>
                <span className="tiny">{claims.length} total</span>
              </div>

              {claims.length === 0 ? (
                <p className="muted small">
                  No claims yet. When someone recognises it, their claim shows up here
                  with their proof.
                </p>
              ) : (
                <div className="claims">
                  {claims.map((claim) => (
                    <div className="claim" key={claim.claim_id}>
                      <div className="claim-head">
                        <div>
                          <b>{claim.claimant_name}</b>{" "}
                          <StatusBadge status={claim.claim_status} />
                        </div>
                        <span className="tiny">{timeAgo(claim.created_at)}</span>
                      </div>

                      <p className="tiny" style={{ margin: "0.15rem 0 0.4rem" }}>
                        {claim.claimant_email}
                        {claim.claimant_phone ? ` · ${claim.claimant_phone}` : ""}
                        {claim.claimant_id_number
                          ? ` · ID ${claim.claimant_id_number}`
                          : ""}
                      </p>

                      <p className="proof">{claim.description_provided}</p>
                      {(claim.evidence ?? []).map((evidence) => (
                        <p className="tiny" key={evidence.claim_evidence_id}>
                          Proof ({evidence.evidence_type.replace(/_/g, " ")}):{" "}
                          {evidence.details}
                        </p>
                      ))}

                      {claim.claim_status === "pending" ? (
                        <form action={reviewClaimAction} className="claim-form">
                          <input type="hidden" name="claim_id" value={claim.claim_id} />
                          <input
                            type="hidden"
                            name="redirect_to"
                            value={`/items/${item.item_id}`}
                          />
                          <input
                            name="remarks"
                            placeholder="Remark shown to the claimant (optional)"
                          />
                          <div className="btn-row">
                            <SubmitButton
                              className="pri sm"
                              name="decision"
                              value="approved"
                              pendingLabel="Saving…"
                            >
                              Approve claim
                            </SubmitButton>
                            <SubmitButton
                              className="sm"
                              name="decision"
                              value="rejected"
                              pendingLabel="Saving…"
                            >
                              Reject
                            </SubmitButton>
                          </div>
                        </form>
                      ) : null}

                      {claim.claim_status === "approved" && !claim.returned_at ? (
                        <form action={releaseItemAction} className="claim-form">
                          <input type="hidden" name="claim_id" value={claim.claim_id} />
                          <input
                            type="hidden"
                            name="redirect_to"
                            value={`/items/${item.item_id}`}
                          />
                          <div className="two">
                            <div>
                              <label htmlFor={`received-${claim.claim_id}`}>
                                Received by
                              </label>
                              <input
                                id={`received-${claim.claim_id}`}
                                name="received_by_name"
                                defaultValue={claim.claimant_name}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor={`id-${claim.claim_id}`}>
                                ID presented
                              </label>
                              <input
                                id={`id-${claim.claim_id}`}
                                name="id_presented"
                                placeholder="e.g. School ID 2024-0001"
                                required
                              />
                            </div>
                          </div>
                          <div className="btn-row mt1">
                            <SubmitButton className="pri sm" pendingLabel="Saving…">
                              Mark as handed over
                            </SubmitButton>
                          </div>
                        </form>
                      ) : null}

                      {claim.claim_status === "rejected" && claim.remarks ? (
                        <p className="tiny">Reason: {claim.remarks}</p>
                      ) : null}
                      {claim.returned_at ? (
                        <p className="tiny">
                          ✔ Released to {claim.received_by_name} on{" "}
                          {fmtDateTime(claim.returned_at)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {active || item.status === "claimed" ? (
                <div className="card mt2">
                  <h3>Where is the item now?</h3>
                  <p className="tiny">
                    Keep it with you, or record that you dropped it at the office.
                  </p>
                  <form action={updateStorageAction} className="bar">
                    <input type="hidden" name="item_id" value={item.item_id} />
                    <select
                      name="storage_location_id"
                      defaultValue={item.storage_location_id ?? ""}
                      aria-label="Storage location"
                      style={{ flex: 1 }}
                    >
                      <option value="">With me (not at the office)</option>
                      {storageLocations.map((location) => (
                        <option key={location.location_id} value={location.location_id}>
                          {location.location_name}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="sm" pendingLabel="Saving…">
                      Update
                    </SubmitButton>
                  </form>
                </div>
              ) : null}

              {!item.response_to_lost_report_id && openReports.length > 0 ? (
                <details className="attach mt2">
                  <summary>🔗 Link this item to a lost post</summary>
                  <form action={linkItemToLostReportAction}>
                    <input type="hidden" name="item_id" value={item.item_id} />
                    <select name="lost_report_id" required defaultValue="">
                      <option value="" disabled>
                        Choose a lost post
                      </option>
                      {openReports.map((report) => (
                        <option key={report.lost_report_id} value={report.lost_report_id}>
                          {report.title} · by {report.owner_name}
                        </option>
                      ))}
                    </select>
                    <input
                      name="note"
                      placeholder="Note for the owner (optional)"
                      style={{ marginTop: "0.5rem" }}
                    />
                    <div className="btn-row mt1">
                      <SubmitButton className="pri sm" pendingLabel="Linking…">
                        Link and notify owner
                      </SubmitButton>
                    </div>
                  </form>
                </details>
              ) : null}

              {staff && active ? (
                <details className="attach mt2">
                  <summary>🗑️ Dispose an unclaimed item</summary>
                  <form action={disposeItemAction}>
                    <input type="hidden" name="item_id" value={item.item_id} />
                    <div className="two">
                      <div>
                        <label htmlFor="disposal_method">Method</label>
                        <select id="disposal_method" name="disposal_method">
                          <option value="donated">Donated</option>
                          <option value="recycled">Recycled</option>
                          <option value="discarded">Discarded</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="donated_to">Donated to</label>
                        <input id="donated_to" name="donated_to" placeholder="Optional" />
                      </div>
                    </div>
                    <input
                      name="remarks"
                      placeholder="Remarks"
                      style={{ marginTop: "0.5rem" }}
                    />
                    <div className="btn-row mt1">
                      <SubmitButton className="sm danger" pendingLabel="Disposing…">
                        Mark as disposed
                      </SubmitButton>
                    </div>
                  </form>
                </details>
              ) : null}
            </>
          ) : null}

          {staff && history.length > 0 ? (
            <div className="card mt2">
              <h3>Status history</h3>
              <div className="timeline mt1">
                {history.map((entry) => (
                  <div className="row" key={entry.item_status_history_id}>
                    <span className="dot" />
                    <div className="grow">
                      <b>{statusLabel(entry.new_status)}</b>{" "}
                      <span className="muted">
                        {entry.old_status
                          ? `from ${statusLabel(entry.old_status)}`
                          : "created"}{" "}
                        · {fmtDateTime(entry.changed_at)} · {entry.full_name}
                      </span>
                      {entry.remarks ? (
                        <div className="tiny">{entry.remarks}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="detail-side">
          {active && !isFinder ? (
            myClaim ? (
              <div className="card">
                <h3>Your claim</h3>
                <p>
                  <StatusBadge status={myClaim.claim_status} />{" "}
                  <span className="tiny">submitted {timeAgo(myClaim.created_at)}</span>
                </p>
                <p className="small">{myClaim.description_provided}</p>
                {myClaim.remarks ? (
                  <p className="small muted">Note: {myClaim.remarks}</p>
                ) : null}
                {myClaim.claim_status === "approved" ? (
                  <div className="notice good">
                    Approved! The finder will arrange the hand-over with you.
                    {item.finder_email ? ` Contact: ${item.finder_email}` : ""}
                  </div>
                ) : (
                  <p className="tiny">
                    The finder or staff will review it. You&apos;ll get a
                    notification either way.
                  </p>
                )}
                <Link href="/claims" className="btn block mt1">
                  My claims
                </Link>
              </div>
            ) : (
              <div className="card">
                <h3>Is this yours? Claim it</h3>
                <p className="tiny">
                  Describe it in your own words. The finder or staff approves the
                  claim.
                </p>
                <form action={claimItemAction}>
                  <input type="hidden" name="item_id" value={item.item_id} />
                  <label htmlFor="description_provided">Describe the item</label>
                  <textarea
                    id="description_provided"
                    name="description_provided"
                    rows={3}
                    required
                    minLength={10}
                    placeholder="Marks, contents, scratches, anything only the owner knows…"
                  />

                  <div className="two">
                    <div>
                      <label htmlFor="evidence_type">Proof type</label>
                      <select id="evidence_type" name="evidence_type" defaultValue="other">
                        <option value="other">Other</option>
                        <option value="serial_number">Serial number</option>
                        <option value="receipt">Receipt</option>
                        <option value="id">ID</option>
                        <option value="photo">Photo</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="evidence_details">Proof details</label>
                      <input
                        id="evidence_details"
                        name="evidence_details"
                        placeholder="Serial no., receipt no.…"
                      />
                    </div>
                  </div>

                  {myReports.length > 0 ? (
                    <>
                      <label htmlFor="lost_report_id">Link to my lost post</label>
                      <select
                        id="lost_report_id"
                        name="lost_report_id"
                        defaultValue={defaultLostReport}
                      >
                        <option value="">— none —</option>
                        {myReports
                          .filter((report) => report.status !== "closed")
                          .map((report) => (
                            <option key={report.lost_report_id} value={report.lost_report_id}>
                              {report.title}
                            </option>
                          ))}
                      </select>
                    </>
                  ) : (
                    <p className="tiny mt1">
                      No lost post from you yet.{" "}
                      <Link href="/lost/new">Post one</Link> so the finder has
                      context.
                    </p>
                  )}

                  <div className="mt2">
                    <SubmitButton className="pri block" pendingLabel="Submitting…">
                      Submit claim
                    </SubmitButton>
                  </div>
                </form>
              </div>
            )
          ) : null}

          {!active && !canManage ? (
            <div className="card">
              <h3>No longer available</h3>
              <p className="small muted">
                This item is <b>{statusLabel(item.status)}</b>, so new claims are
                closed.
              </p>
              <Link href="/items" className="btn block mt1">
                Browse other found items
              </Link>
            </div>
          ) : null}

          <div className="card flat">
            <h3>Reported by</h3>
            <div className="row">
              <div className="btn-row">
                <Avatar name={item.finder_name} />
                <div>
                  <b>{item.finder_name}</b>
                  <div className="tiny">{roleLabel(item.finder_role_id)}</div>
                </div>
              </div>
            </div>
            {canManage || (myClaim?.claim_status === "approved") ? (
              <p className="small muted mt1">
                {item.finder_email ? `Contact: ${item.finder_email}` : "Contact via the conversation."}
              </p>
            ) : (
              <p className="tiny mt1">
                Contact details are shared once your claim is approved.
              </p>
            )}
            {item.response_lost_id ? (
              <Link
                href={`/lost/${item.response_lost_id}`}
                className="btn block sm mt1"
              >
                Open the linked conversation
              </Link>
            ) : null}
            {isFinder ? (
              <p className="tiny mt1">
                This is your item. When a claim is approved, hand it over and mark it
                as returned.
              </p>
            ) : null}
          </div>

          {isFinder && !item.response_to_lost_report_id ? (
            <div className="card flat">
              <h3>Know who lost it?</h3>
              <p className="small muted">
                Link this item to their lost post, and they get a message with the
                item attached.
              </p>
              <Link href="/feed" className="btn block sm mt1">
                Find their post
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
