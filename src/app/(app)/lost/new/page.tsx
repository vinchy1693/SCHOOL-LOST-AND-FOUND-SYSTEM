import Link from "next/link";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { createLostReportAction } from "@/lib/actions";
import { optionalParam, type SearchParams } from "@/lib/params";
import { getMeta } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Report a lost item" };

export default async function NewLostReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const sp = await searchParams;
  const { categories } = await getMeta();

  return (
    <div>
      <div className="crumbs">
        <Link href="/feed">← Lost board</Link>
      </div>

      <div className="page-head">
        <div>
          <h1>Report a lost item</h1>
          <p className="muted">
            The more specific you are, the easier it is for a finder to recognise
            it and reply.
          </p>
        </div>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      <div className="detail-grid">
        <div className="card">
          <form action={createLostReportAction}>
            <label htmlFor="title">What did you lose?</label>
            <input
              id="title"
              name="title"
              required
              minLength={3}
              maxLength={150}
              placeholder="e.g. Black Casio fx-991 calculator"
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
                <label htmlFor="date_lost">Date lost</label>
                <input
                  id="date_lost"
                  type="date"
                  name="date_lost"
                  required
                  max={todayISO()}
                  defaultValue={todayISO()}
                />
              </div>
            </div>

            <div className="two">
              <div>
                <label htmlFor="brand">Brand</label>
                <input id="brand" name="brand" placeholder="e.g. Casio" />
              </div>
              <div>
                <label htmlFor="color">Color</label>
                <input id="color" name="color" placeholder="e.g. black" />
              </div>
            </div>

            <label htmlFor="last_seen_location">Where did you last see it?</label>
            <input
              id="last_seen_location"
              name="last_seen_location"
              placeholder="e.g. CL7, library 2nd floor"
            />

            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Marks, stickers, contents — anything that helps identify it. Do not post a secret you would not want others to know."
            />

            <div className="mt2">
              <SubmitButton className="pri" pendingLabel="Posting…">
                Post lost item
              </SubmitButton>
            </div>
          </form>
        </div>

        <aside className="detail-side">
          <div className="card flat">
            <h3>How this works</h3>
            <p className="small muted">
              Your post appears on the board right away. Anyone signed in can
              reply — and when a finder attaches the item they filed, you get a
              link straight to it.
            </p>
            <div className="notice mt1">
              💬 Replies show up under your post and in <b>Messages</b>.
            </div>
          </div>
          <div className="card flat">
            <h3>Tips</h3>
            <ul className="small muted" style={{ paddingLeft: "1.1rem", margin: 0 }}>
              <li>Describe marks only the real owner would know.</li>
              <li>Check the Found items page too — someone may have filed it already.</li>
              <li>Close the post when you get your item back.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
