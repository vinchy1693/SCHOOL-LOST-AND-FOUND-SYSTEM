import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { updateUsersAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { fmtDate, roleLabel } from "@/lib/format";
import { optionalParam, type SearchParams } from "@/lib/params";
import { listAdminUsers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const users = await listAdminUsers();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="muted">
            Change a role or disable an account. You cannot change your own role or
            status.
          </p>
        </div>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      <form action={updateUsersAction}>
        <div className="card tablewrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>ID no.</th>
                <th>Role</th>
                <th>Active</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.user_id === admin.user_id;
                return (
                  <tr key={user.user_id}>
                    <td>
                      <b>{user.full_name}</b>
                      {isSelf ? <span className="chip" style={{ marginLeft: 6 }}>you</span> : null}
                      <div className="tiny">
                        {user.user_type}
                        {user.department_code ? ` · ${user.department_code}` : ""}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.id_number || "—"}</td>
                    <td>
                      {isSelf ? (
                        <span className="chip">{roleLabel(user.role_id)}</span>
                      ) : (
                        <select
                          name={`role_${user.user_id}`}
                          defaultValue={user.role_id}
                          aria-label={`Role for ${user.full_name}`}
                        >
                          <option value="1">Admin</option>
                          <option value="2">Staff</option>
                          <option value="3">User</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {isSelf ? (
                        <span className="badge b-approved">Active</span>
                      ) : (
                        <input
                          type="checkbox"
                          name={`active_${user.user_id}`}
                          defaultChecked={user.is_active === 1}
                          aria-label={`Active for ${user.full_name}`}
                        />
                      )}
                    </td>
                    <td className="tiny">{fmtDate(user.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="btn-row mt2">
          <SubmitButton className="pri" pendingLabel="Saving…">
            Save changes
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
