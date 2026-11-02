import Link from "next/link";
import { fmtDate } from "@/lib/format";
import type { Item } from "@/lib/types";
import StatusBadge from "./StatusBadge";

export default function ItemCard({
  item,
  showStatus = false,
}: {
  item: Item;
  showStatus?: boolean;
}) {
  const claims = Number(item.pending_claims || 0);
  return (
    <Link href={`/items/${item.item_id}`} className="item-card">
      <div className="photo">
        {item.image ? <img src={item.image} alt={item.title} /> : "📦"}
      </div>
      <div className="body">
        <h3>{item.title}</h3>
        <div className="meta">
          {item.category_name} · {item.found_location || "Unknown spot"}
        </div>
        <div className="meta">Found {fmtDate(item.date_found)}</div>
        <div className="foot">
          <span>{item.finder_name}</span>
          {showStatus ? (
            <StatusBadge status={item.status} />
          ) : claims > 0 ? (
            <span>
              {claims} claim{claims === 1 ? "" : "s"}
            </span>
          ) : (
            <span>Open</span>
          )}
        </div>
      </div>
    </Link>
  );
}
