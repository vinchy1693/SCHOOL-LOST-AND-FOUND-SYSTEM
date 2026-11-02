import Link from "next/link";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { createFoundItemAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { optionalParam, param, type SearchParams } from "@/lib/params";
import { getLostPost, getMeta, listOpenLostReports } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Report a found item" };

export default async function NewFoundItemPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const sp = await searchParams;
  const lostReportId = Number(param(sp.lost_report_id)) || null;

  const [{ categories }, openReports] = await Promise.all([
    getMeta(),
    listOpenLostReports(),
  ]);

  const report = lostReportId ? await getLostPost(lostReportId) : null;
  const linkOptions =
    report && !openReports.some((entry) => entry.lost_report_id === report.lost_report_id)
      ? [report, ...openReports]
      : openReports;

  return (
    <div>
      <div className="crumbs">
        <Link href="/items">← Found items</Link>
        {report ? (
          <>
            {" · "}
            <Link href={`/lost/${report.lost_report_id}`}>Back to the post</Link>
          </>
        ) : null}
      </div>

      <div className="page-head">
        <div>
          <h1>Report a found item</h1>
          <p className="muted">
            File it so everyone can check it — and link it to a lost post so the
            owner gets a message with the item attached.
          </p>
        </div>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      <div className="detail-grid">
        <div className="card">
          {report ? (
            <div className="notice mb2">
              You are filing this for{" "}
              <Link href={`/lost/${report.lost_report_id}`}>
                “{report.title}”
              </Link>{" "}
              by {report.owner_name}. Posting will add a reply with this item to
              their thread.
            </div>
          ) : null}

          <form action={createFoundItemAction}>
            <label htmlFor="title">What did you find?</label>
            <input
              id="title"
              name="title"
              required
              minLength={3}
              maxLength={150}
              placeholder="e.g. Blue Jansport backpack"
              autoFocus
            />

            <div className="two">
              <div>
                <label htmlFor="category_id">Category</label>
                <select id="category_id" name="category_id" required defaultValue="">
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {categories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="date_found">Date found</label>
                <input
                  id="date_found"
                  type="date"
                  name="date_found"
                  required
                  max={todayISO()}
                  defaultValue={todayISO()}
                />
              </div>
            </div>

            <label htmlFor="found_location">Where did you find it?</label>
            <input
              id="found_location"
              name="found_location"
              required
              maxLength={150}
              placeholder="e.g. Library 2nd floor, near the stairs"
            />

            <div className="two">
              <div>
                <label htmlFor="brand">Brand</label>
                <input id="brand" name="brand" maxLength={100} placeholder="e.g. Jansport" />
              </div>
              <div>
                <label htmlFor="color">Color</label>
                <input id="color" name="color" maxLength={50} placeholder="e.g. navy blue" />
              </div>
            </div>

            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Condition, contents, marks — enough for the owner to recognise it."
            />

            <label htmlFor="image">Photo</label>
            <input id="image" type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" />
            <p className="field-note">JPG, PNG, WEBP or GIF · up to 5 MB.</p>

            <label htmlFor="response_to_lost_report_id">
              Link to a lost post (optional)
            </label>
            <select
              id="response_to_lost_report_id"
              name="response_to_lost_report_id"
              defaultValue={report?.lost_report_id ?? ""}
            >
              <option value="">— no linked post —</option>
              {linkOptions.map((entry) => (
                <option key={entry.lost_report_id} value={entry.lost_report_id}>
                  {entry.title} · by {entry.owner_name}
                </option>
              ))}
            </select>
            <p className="field-note">
              Linking posts a reply with this item on the owner&apos;s thread, so
              they can open it directly.
            </p>

            <label htmlFor="note">Note for the owner</label>
            <textarea
              id="note"
              name="note"
              rows={2}
              placeholder="e.g. I found it after your class. It is with me at the guard house."
            />

            <label className="check">
              <input type="checkbox" name="is_valuable" value="1" />
              <span>
                Valuable item — hide brand, color and description from other users
                until a claim is verified.
              </span>
            </label>

            <div className="mt2">
              <SubmitButton className="pri" pendingLabel="Filing item…">
                File found item
              </SubmitButton>
            </div>
          </form>
        </div>

        <aside className="detail-side">
          <div className="card flat">
            <h3>What happens next</h3>
            <ol className="small muted" style={{ paddingLeft: "1.1rem", margin: 0 }}>
              <li>Your item appears on the Found items page.</li>
              <li>The owner (or anyone) can open it and submit a claim.</li>
              <li>You or staff approve the claim, then arrange the hand-over.</li>
            </ol>
          </div>

          <div className="card flat">
            <h3>Keep it safe</h3>
            <p className="small muted">
              You can keep the item with you, or drop it at the Lost &amp; Found
              office and set that on the item page so claimants know where to go.
            </p>
          </div>

          <div className="card flat">
            <h3>Already see the owner&apos;s post?</h3>
            <p className="small muted">
              Open the lost board, find their post, and use{" "}
              <b>“I found this item”</b> — it fills in the link for you.
            </p>
            <Link href="/feed" className="btn block mt1">
              Open the lost board
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
