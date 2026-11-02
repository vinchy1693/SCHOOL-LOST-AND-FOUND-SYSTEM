import Sidebar from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import {
  getPendingClaimCount,
  getUnreadMessageCount,
  getUnreadNotificationCount,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const staff = user.role_id <= 2;

  const [unreadMessages, unreadNotifications, pendingClaims] = await Promise.all([
    getUnreadMessageCount(user.user_id),
    getUnreadNotificationCount(user.user_id),
    staff ? getPendingClaimCount() : Promise.resolve(0),
  ]);

  return (
    <div className="shell">
      <Sidebar
        user={user}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
        pendingClaims={pendingClaims}
      />
      <main className="main">{children}</main>
    </div>
  );
}
