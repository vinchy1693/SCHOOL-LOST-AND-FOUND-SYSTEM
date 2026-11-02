import Link from "next/link";
import Empty from "@/components/Empty";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { releaseItemAction, reviewClaimAction } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { optionalParam, param, type SearchParams } from "@/lib/params";
import { listClaims } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Claim queue" };

const FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

export default async function ClaimQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireStaff();
  const sp = await searchParams;
  const status = param(sp.status);
  const current = ["pending", "approved", "rejected"].includes(status) ? status : "";
  const claims = await listClaims({ status: current || null });
  const redirectTo = `/dashboard/claims${current ? `?status=${current}` : ""}`;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Claim queue</h1>
          <p className="muted">
            Review owner claims, or hand over items that were already approved. The
            finder can approve too.
          </p>
        </div>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      <div className="btn-row mb2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value || "all"}
            href={`/dashboard/claims${filter.value ? `?status=${filter.value}` : ""}`}
            className={`btn sm${current === filter.value ? " pri" : ""}`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {claims.length === 0 ? (
        <Empty emoji="🗂️" title="No claims in this view">
          When a student claims a found item, it appears here for approval.
        </Empty>
      ) : (
        <div className="list">
          {claims.map((claim) => (
            <article className="card" key={claim.claim_id}>
              <div className="row">
                <div className="grow">
                  <h3 style={{ marginBottom: "0.2rem" }}>
                    <Link href={`/items/${claim.item_id}`}>{claim.item_title}</Link>{" "}
                    <StatusBadge status={claim.claim_status} />
                  </h3>
                  <p className="tiny">
                    {claim.item_code} · claimed by <b>{claim.claimant_name}</b> ·{" "}
                    {timeAgo(claim.created_at)} · filed by {claim.finder_name}
                  </p>
                </div>
                <Link href={`/items/${claim.item_id}`} className="btn sm">
                  View item
                </Link>
              </div>

              <p className="small mt1">{claim.description_provided}</p>
              {(claim.evidence ?? []).map((evidence) => (
                <p className="tiny" key={evidence.claim_evidence_id}>
                  Proof ({evidence.evidence_type.replace(/_/g, " ")}): {evidence.details}
                </p>
              ))}

              <p className="tiny">
                {claim.claimant_email}
                {claim.claimant_phone ? ` · ${claim.claimant_phone}` : ""}
                {claim.claimant_id_number ? ` · ID ${claim.claimant_id_number}` : ""}
              </p>

              {claim.claim_status === "pending" ? (
                <form action={reviewClaimAction} className="claim-form">
                  <input type="hidden" name="claim_id" value={claim.claim_id} />
                  <input type="hidden" name="redirect_to" value={redirectTo} />
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
                  <input type="hidden" name="redirect_to" value={redirectTo} />
                  <div className="two">
                    <div>
                      <label htmlFor={`received-${claim.claim_id}`}>Received by</label>
                      <input
                        id={`received-${claim.claim_id}`}
                        name="received_by_name"
                        defaultValue={claim.claimant_name}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor={`id-${claim.claim_id}`}>ID presented</label>
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

              {claim.returned_at ? (
                <p className="tiny mt1">
                  ✔ Released to {claim.received_by_name} on{" "}
                  {fmtDateTime(claim.returned_at)}
                </p>
              ) : null}
              {claim.claim_status === "rejected" && claim.remarks ? (
                <p className="tiny mt1">Reason: {claim.remarks}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
