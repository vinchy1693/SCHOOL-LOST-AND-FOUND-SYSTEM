import Link from "next/link";
import { redirect } from "next/navigation";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { registerAction } from "@/lib/actions";
import { getSessionUser, homeFor } from "@/lib/auth";
import { getMeta } from "@/lib/queries";
import { optionalParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create an account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));

  const sp = await searchParams;
  const { departments } = await getMeta();

  return (
    <main className="auth-wrap">
      <section className="auth-art">
        <span className="mark" aria-hidden="true">
          🔎
        </span>
        <div>
          <h1>Join the board</h1>
          <p>
            Your account lets you report what you lost, file what you found, and
            keep the conversation in one place.
          </p>
        </div>
        <ol>
          <li>Report a lost item and share the details that only you would know.</li>
          <li>File a found item so the whole campus can check it.</li>
          <li>Reply on a lost post with a link to the item — no page-hopping.</li>
        </ol>
        <p className="foot">Anyone with a campus email can join.</p>
      </section>

      <section className="auth-form">
        <div className="auth-card">
          <h1>Create your account</h1>
          <p className="sub">It takes less than a minute.</p>
          <Flash err={optionalParam(sp.err)} />
          <div className="card">
            <form action={registerAction}>
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" required autoComplete="name" />

              <div className="two">
                <div>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    minLength={6}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="two">
                <div>
                  <label htmlFor="user_type">I am a</label>
                  <select id="user_type" name="user_type" defaultValue="student">
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="staff">Staff</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="id_number">ID number</label>
                  <input id="id_number" name="id_number" placeholder="Optional" />
                </div>
              </div>

              <div className="two">
                <div>
                  <label htmlFor="department_id">Department</label>
                  <select id="department_id" name="department_id" defaultValue="">
                    <option value="">— none —</option>
                    {departments.map((department) => (
                      <option
                        key={department.department_id}
                        value={department.department_id}
                      >
                        {department.department_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="year_level">Year level</label>
                  <input id="year_level" name="year_level" placeholder="e.g. 3rd year" />
                </div>
              </div>

              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" placeholder="Optional" />

              <div className="mt2">
                <SubmitButton className="pri block" pendingLabel="Creating account…">
                  Create account
                </SubmitButton>
              </div>
            </form>
          </div>
          <p className="alt">
            Already registered? <Link href="/login">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
