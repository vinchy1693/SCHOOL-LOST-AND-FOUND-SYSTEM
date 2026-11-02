import { statusLabel } from "@/lib/format";

export default function StatusBadge({ status }: { status?: string | null }) {
  return (
    <span className={`badge b-${status || "muted"}`}>{statusLabel(status)}</span>
  );
}
