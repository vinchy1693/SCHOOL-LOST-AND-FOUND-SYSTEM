import Link from "next/link";

export default function Empty({
  emoji = "📭",
  title,
  children,
  action,
}: {
  emoji?: string;
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty">
      <span className="emoji" aria-hidden="true">
        {emoji}
      </span>
      <b>{title}</b>
      {children ? <div className="small mt1">{children}</div> : null}
      {action ? (
        <div className="mt2">
          <Link href={action.href} className="btn pri sm">
            {action.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
