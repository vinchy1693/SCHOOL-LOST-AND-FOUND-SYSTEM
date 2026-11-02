import Link from "next/link";
import Empty from "@/components/Empty";
import Flash from "@/components/Flash";
import ItemCard from "@/components/ItemCard";
import { requireUser } from "@/lib/auth";
import { optionalParam, param, type SearchParams } from "@/lib/params";
import { getMeta, listFoundItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Found items" };

export default async function FoundItemsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const staff = user.role_id <= 2;
  const sp = await searchParams;

  const search = param(sp.q).trim();
  const categoryId = Number(param(sp.category)) || null;
  const status = param(sp.status);
  const mine = param(sp.mine) === "1";

  const [{ categories }, items] = await Promise.all([
    getMeta(),
    mine
      ? listFoundItems({
          search: search || undefined,
          categoryId,
          reportedBy: user.user_id,
          status: staff ? status || null : null,
        })
      : staff
        ? listFoundItems({
            search: search || undefined,
            categoryId,
            status: status || null,
          })
        : listFoundItems({
            search: search || undefined,
            categoryId,
            onlyActive: true,
          }),
  ]);

  const statuses = ["found", "in_storage", "claimed", "returned", "disposed"];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{mine ? "Items I filed" : "Found items"}</h1>
          <p className="muted">
            {mine
              ? "Everything you have reported finding, with the owner claims on each item."
              : "Items found on campus. See something that is yours? Open it and submit a claim."}
          </p>
        </div>
        <Link href="/items/new" className="btn pri">
          ＋ Report found item
        </Link>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      <form className="filters" action="/items" method="get">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search title, brand, color, code…"
          aria-label="Search found items"
        />
        <select name="category" defaultValue={categoryId ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.category_name}
            </option>
          ))}
        </select>
        {staff ? (
          <select name="status" defaultValue={status} aria-label="Status">
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        ) : null}
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} />
          <span>My filed items</span>
        </label>
        <button type="submit" className="btn">
          Filter
        </button>
      </form>

      {!staff ? (
        <p className="notice mb2">
          Tip: some valuable items hide identifying details. That is on purpose —
          describe the item in your claim and it will be verified.
        </p>
      ) : null}

      {items.length === 0 ? (
        <Empty
          emoji="📦"
          title={mine ? "You have not filed any found items" : "No found items match"}
          action={{ href: "/items/new", label: "Report a found item" }}
        >
          Found something on campus? File it so the owner can find it.
        </Empty>
      ) : (
        <div className="grid">
          {items.map((item) => (
            <ItemCard key={item.item_id} item={item} showStatus={staff || mine} />
          ))}
        </div>
      )}
    </div>
  );
}
