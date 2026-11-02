"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "./Avatar";
import { logoutAction } from "@/lib/actions";
import { roleLabel } from "@/lib/format";
import type { User } from "@/lib/types";

function NavLink({
  href,
  icon,
  label,
  count = 0,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`side-link${active ? " on" : ""}`}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <span className="ico" aria-hidden="true">
        {icon}
      </span>
      <span className="lbl">{label}</span>
      {count > 0 ? (
        <span className="count">{count > 99 ? "99+" : count}</span>
      ) : null}
    </Link>
  );
}

export default function Sidebar({
  user,
  unreadNotifications,
  unreadMessages,
  pendingClaims,
}: {
  user: User;
  unreadNotifications: number;
  unreadMessages: number;
  pendingClaims: number;
}) {
  const pathname = usePathname();
  const staff = user.role_id <= 2;
  const admin = user.role_id === 1;

  const active = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="side">
      <Link href={staff ? "/dashboard" : "/feed"} className="side-brand">
        <span className="mark" aria-hidden="true">
          🔎
        </span>
        <span>
          <b>Lost &amp; Found</b>
          <small>Campus board</small>
        </span>
      </Link>

      <Link href="/lost/new" className="side-cta">
        ＋ Report a lost item
      </Link>

      <nav className="side-nav" aria-label="Main">
        <NavLink href="/feed" icon="📋" label="Lost board" active={active("/feed")} />
        <NavLink href="/items" icon="📦" label="Found items" active={active("/items")} />
        <NavLink href="/lost" icon="📝" label="My lost posts" active={active("/lost")} />
        <NavLink
          href="/messages"
          icon="💬"
          label="Messages"
          count={unreadMessages}
          active={active("/messages")}
        />
        <NavLink
          href="/notifications"
          icon="🔔"
          label="Notifications"
          count={unreadNotifications}
          active={active("/notifications")}
        />
        <NavLink href="/claims" icon="✅" label="My claims" active={active("/claims")} />
      </nav>

      {staff ? (
        <>
          <div className="side-label">Staff</div>
          <nav className="side-nav" aria-label="Staff">
            <NavLink
              href="/dashboard"
              icon="📊"
              label="Dashboard"
              active={active("/dashboard")}
            />
            <NavLink
              href="/dashboard/claims"
              icon="🗂️"
              label="Claim queue"
              count={pendingClaims}
              active={pathname.startsWith("/dashboard/claims")}
            />
            <NavLink
              href="/dashboard/reports"
              icon="🧭"
              label="Lost reports"
              active={pathname.startsWith("/dashboard/reports")}
            />
          </nav>
        </>
      ) : null}

      {admin ? (
        <>
          <div className="side-label">Admin</div>
          <nav className="side-nav" aria-label="Admin">
            <NavLink href="/admin/users" icon="👥" label="Users" active={active("/admin/users")} />
            <NavLink
              href="/admin/settings"
              icon="⚙️"
              label="Settings"
              active={active("/admin/settings")}
            />
          </nav>
        </>
      ) : null}

      <div className="side-user">
        <Avatar name={user.full_name} size="sm" />
        <div className="who">
          <b>{user.full_name}</b>
          <small>
            {roleLabel(user.role_id)} · {user.email}
          </small>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="link-btn" aria-label="Log out" title="Log out">
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
