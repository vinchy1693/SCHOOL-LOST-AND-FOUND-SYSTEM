import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <section className="auth-form">
        <div className="auth-card center">
          <div style={{ fontSize: "3rem" }} aria-hidden="true">
            🧭
          </div>
          <h1>Page not found</h1>
          <p className="sub">
            That post or item may have been removed, or the link is wrong.
          </p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <Link href="/feed" className="btn pri">
              Back to the board
            </Link>
            <Link href="/items" className="btn">
              Found items
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
