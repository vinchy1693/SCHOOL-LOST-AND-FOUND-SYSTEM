import Link from "next/link";
import Empty from "@/components/Empty";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { confirmMatchAction } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { excerpt, fmtDate } from "@/lib/format";
import { optionalParam, param, type SearchParams } from "@/lib/params";
import { getLostPost, getSuggestedMatches, listLostPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lost reports" };

export default async function StaffReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireStaff();
  const sp = await searchParams;
  const matchId = Number(param(sp.match)) || null;

  const reports = await listLostPosts({ includeClosed: true, limit: 100 });
  const [matchPost, matches] = matchId
    ? await Promise.all([getLostPost(matchId), getSuggestedMatches(matchId)])
    : [null, []];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Lost reports</h1>
          <p className="muted">
            Every post on the board. Use matching to connect a report to a filed
            item — the owner gets a reply with the item attached.
          </p>
        </div>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      {matchPost ? (
        <div className="card mb2">
          <div className="row">
            <div className="grow">
              <h2>Possible matches for “{matchPost.title}”</h2>
              <p className="tiny">
                {matchPost.category_name} · lost {fmtDate(matchPost.date_lost)} ·
                owner {matchPost.owner_name}
              </p>
            </div>
            <Link href="/dashboard/reports" className="btn sm">
              Close
            </Link>
          </div>

          {matches.length === 0 ? (
            <p className="muted small mt1">
              No similar items found yet. Confirming a match posts a reply on the
              owner&apos;s thread with the item linked.
            </p>
          ) : (
            <div className="list mt1">
              {matches.map((match) => (
                <div className="itemlink" key={match.item_id}>
                  <span className="thumb">
                    {match.image ? <img src={match.image} alt="" /> : "📦"}
                  </span>
                  <span className="tx">
                    <b>
                      <Link href={`/items/${match.item_id}`}>{match.title}</Link>
                    </b>
                    <small>
                      {match.item_code} · {match.category_name} · found{" "}
                      {fmtDate(match.date_found)} · score {match.score}%
                    </small>
                  </span>
                  {match.match_status === "confirmed" ? (
                    <span className="badge b-confirmed">Confirmed</span>
                  ) : (
                    <form action={confirmMatchAction}>
                      <input
                        type="hidden"
                        name="lost_report_id"
                        value={matchPost.lost_report_id}
                      />
                      <input type="hidden" name="item_id" value={match.item_id} />
                      <input type="hidden" name="score" value={match.score} />
                      <SubmitButton className="pri sm" pendingLabel="Saving…">
                        Confirm
                      </SubmitButton>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {reports.length === 0 ? (
        <Empty emoji="🧭" title="No lost reports yet">
          When a student posts a lost item, it appears here.
        </Empty>
      ) : (
        <div className="list">
          {reports.map((report) => (
            <article className="card" key={report.lost_report_id}>
              <div className="row">
                <div className="grow">
                  <h3 style={{ marginBottom: "0.2rem" }}>
                    <Link href={`/lost/${report.lost_report_id}`}>{report.title}</Link>{" "}
                    <StatusBadge status={report.status} />
                  </h3>
                  <p className="tiny">
                    {report.category_name} · owner {report.owner_name} · lost{" "}
                    {fmtDate(report.date_lost)} · {report.message_count ?? 0} replies
                    {report.last_seen_location
                      ? ` · last seen ${report.last_seen_location}`
                      : ""}
                  </p>
                  {report.description ? (
                    <p className="small muted mt1">
                      {excerpt(report.description, 180)}
                    </p>
                  ) : null}
                </div>
                <div className="btn-row">
                  <Link
                    href={`/lost/${report.lost_report_id}`}
                    className="btn sm"
                  >
                    Open post
                  </Link>
                  <Link
                    href={`/dashboard/reports?match=${report.lost_report_id}`}
                    className="btn pri sm"
                  >
                    Find matches
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
