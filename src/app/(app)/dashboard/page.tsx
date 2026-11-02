import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { getStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireStaff();
  const stats = await getStats();

  const unclaimed = (stats.items.found ?? 0) + (stats.items.in_storage ?? 0);
  const returned = stats.items.returned ?? 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Welcome back, {user.full_name.split(" ")[0]}. Here is what needs
            attention.
          </p>
        </div>
        <div className="btn-row">
          <Link href="/items/new" className="btn pri">
            ＋ Log a found item
          </Link>
          <Link href="/dashboard/reports" className="btn">
            Lost reports
          </Link>
        </div>
      </div>

      <div className="stats">
        <Link href="/dashboard/claims" className={`stat${stats.pendingClaims > 0 ? " hot" : ""}`}>
          <b>{stats.pendingClaims}</b>
          <span>Claims to review</span>
        </Link>
        <Link href="/dashboard/claims?status=approved" className="stat">
          <b>{stats.awaitingRelease}</b>
          <span>Approved, awaiting hand-over</span>
        </Link>
        <Link href="/dashboard/reports" className="stat">
          <b>{stats.openReports}</b>
          <span>Open lost posts</span>
        </Link>
        <Link href="/items" className="stat">
          <b>{unclaimed}</b>
          <span>Unclaimed items</span>
        </Link>
        <Link href="/items?status=returned" className="stat">
          <b>{returned}</b>
          <span>Returned to owners</span>
        </Link>
        {user.role_id === 1 ? (
          <Link href="/admin/users" className="stat">
            <b>{stats.users}</b>
            <span>Active users</span>
          </Link>
        ) : null}
      </div>

      <div className="detail-grid">
        <div className="card">
          <h3>Recent activity</h3>
          {stats.recent.length === 0 ? (
            <p className="muted small">No item activity yet.</p>
          ) : (
            <div className="list mt1">
              {stats.recent.map((entry, index) => (
                <div key={`${entry.item_code}-${index}`} className="row small">
                  <div className="grow">
                    <b>{entry.title}</b>{" "}
                    <span className="tiny">({entry.item_code})</span>
                    <div className="tiny">
                      {fmtDateTime(entry.changed_at)} · by {entry.full_name}
                    </div>
                  </div>
                  <StatusBadge status={entry.new_status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="detail-side">
          <div className="card flat">
            <h3>Two-sided flow</h3>
            <p className="small muted">
              Owners post a lost item. Finders file it and reply on the post with a
              link to the item. Whoever is closest — the finder or staff — can
              approve the claim.
            </p>
            <Link href="/feed" className="btn block sm mt1">
              See the board as students do
            </Link>
          </div>
          <div className="card flat">
            <h3>Quick links</h3>
            <div className="list">
              <Link href="/dashboard/claims" className="btn sm">
                🗂️ Claim queue
              </Link>
              <Link href="/dashboard/reports" className="btn sm">
                🧭 Lost reports &amp; matching
              </Link>
              <Link href="/items?mine=1" className="btn sm">
                📦 Items I filed
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
