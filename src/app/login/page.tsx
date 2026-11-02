import Link from "next/link";
import { redirect } from "next/navigation";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { loginAction } from "@/lib/actions";
import { getSessionUser, homeFor } from "@/lib/auth";
import { optionalParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));

  const sp = await searchParams;
  const err = optionalParam(sp.err);
  const ok = optionalParam(sp.ok);

  return (
    <main className="auth-wrap">
      <section className="auth-art">
        <span className="mark" aria-hidden="true">
          🔎
        </span>
        <div>
          <h1>Campus Lost &amp; Found</h1>
          <p>
            One board for both sides: the person who lost something, and the
            person who found it.
          </p>
        </div>
        <ol>
          <li>
            <b>Lost it?</b> Post it on the board in under a minute.
          </li>
          <li>
            <b>Found it?</b> Reply to the post with the item you filed, so the
            owner can open it straight from the message.
          </li>
          <li>
            <b>Got it back?</b> Claim it, get verified, and arrange the hand-over.
          </li>
        </ol>
        <p className="foot">Built for our campus · Next.js + MySQL</p>
      </section>

      <section className="auth-form">
        <div className="auth-card">
          <h1>Welcome back</h1>
          <p className="sub">Log in to post, reply, and claim.</p>
          <Flash err={err} ok={ok} />
          <div className="card">
            <form action={loginAction}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="you@school.edu"
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <div className="mt2">
                <SubmitButton className="pri block" pendingLabel="Logging in…">
                  Log in
                </SubmitButton>
              </div>
            </form>
          </div>
          <p className="alt">
            New here? <Link href="/register">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
