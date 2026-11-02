const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-10-22" or "2026-10-22 15:48:40" -> "Oct 22, 2026" */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return raw;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-10-22 15:48:40" -> "Oct 22, 2026 · 3:48 PM" */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [date, time = ""] = String(value).split(" ");
  const [h, min] = time.split(":").map(Number);
  if (Number.isNaN(h)) return fmtDate(date);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${fmtDate(date)} · ${hour}:${String(min || 0).padStart(2, "0")} ${suffix}`;
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "";
  const then = new Date(String(value).replace(" ", "T")).getTime();
  if (Number.isNaN(then)) return fmtDate(value);
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(value);
}

export function initials(name: string | null | undefined): string {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "#0f766e", "#7c3aed", "#b45309", "#0369a1",
  "#be123c", "#4d7c0f", "#9333ea", "#0e7490",
];

export function avatarColor(name: string | null | undefined): string {
  const str = String(name || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function excerpt(text: string | null | undefined, length = 160): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= length) return clean;
  return clean.slice(0, length - 1).trimEnd() + "…";
}

export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "found":
      return "Found";
    case "in_storage":
      return "At the office";
    case "claimed":
      return "Claim approved";
    case "returned":
      return "Returned";
    case "disposed":
      return "Disposed";
    case "open":
      return "Open";
    case "matched":
      return "Something turned up";
    case "closed":
      return "Closed";
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return String(status || "").replace(/_/g, " ");
  }
}

export function roleLabel(roleId: number | null | undefined): string {
  return roleId === 1 ? "Admin" : roleId === 2 ? "Staff" : "Student";
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Only allow same-site relative redirect targets. */
export function safePath(value: string | null | undefined, fallback = "/feed"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
