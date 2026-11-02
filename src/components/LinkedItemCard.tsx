import Link from "next/link";
import { statusLabel } from "@/lib/format";

export default function LinkedItemCard({
  itemId,
  title,
  code,
  status,
  image,
  compact = false,
}: {
  itemId: number;
  title?: string | null;
  code?: string | null;
  status?: string | null;
  image?: string | null;
  compact?: boolean;
}) {
  return (
    <Link href={`/items/${itemId}`} className="itemlink">
      <span className="thumb">{image ? <img src={image} alt="" /> : "📦"}</span>
      <span className="tx">
        <b>{title || "Found item"}</b>
        <small>
          {code ? `${code} · ` : ""}
          {statusLabel(status)}
          {compact ? "" : " — open the item to claim it"}
        </small>
      </span>
      <span className="arr" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
