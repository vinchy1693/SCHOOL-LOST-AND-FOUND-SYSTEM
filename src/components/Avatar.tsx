import { avatarColor, initials } from "@/lib/format";

export default function Avatar({
  name,
  size = "",
}: {
  name?: string | null;
  size?: "" | "sm" | "lg";
}) {
  return (
    <span
      className={`avatar ${size}`.trim()}
      style={{ background: avatarColor(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
