import Link from "next/link";
import Empty from "@/components/Empty";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { listClaims } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "My claims" };

export default async function MyClaimsPage() {
  const user = await requireUser();
  const claims = await listClaims({ userId: user.user_id });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My claims</h1>
          <p className="muted">
            Claims you have submitted on found items, with the finder&apos;s decision.
          </p>
        </div>
        <Link href="/items" className="btn">
          Browse found items
        </Link>
      </div>

      {claims.length === 0 ? (
        <Empty
          emoji="✅"
          title="You have not claimed anything yet"
          action={{ href: "/items", label: "Browse found items" }}
        >
          See something that is yours? Open it and describe it to claim.
        </Empty>
      ) : (
        <div className="list">
          {claims.map((claim) => (
            <article className="card" key={claim.claim_id}>
              <div className="row">
                <div className="grow">
                  <h3 style={{ marginBottom: "0.25rem" }}>
                    <Link href={`/items/${claim.item_id}`}>{claim.item_title}</Link>{" "}
                    <StatusBadge status={claim.claim_status} />
                  </h3>
                  <p className="tiny">
                    {claim.item_code} · submitted {timeAgo(claim.created_at)}
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
              {claim.remarks ? (
                <p className="small muted">Note: {claim.remarks}</p>
              ) : null}

              {claim.claim_status === "approved" && !claim.returned_at ? (
                <div className="notice good">
                  Approved — arrange the hand-over with the finder
                  {claim.finder_name ? ` (${claim.finder_name})` : ""}.
                </div>
              ) : null}
              {claim.returned_at ? (
                <p className="small muted">
                  ✔ Released to {claim.received_by_name} on{" "}
                  {fmtDateTime(claim.returned_at)}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
