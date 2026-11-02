"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-wrap">
      <section className="auth-form">
        <div className="auth-card">
          <h1>Something went wrong</h1>
          <p className="sub">
            The page could not load. If this keeps happening, check that MySQL is
            running in XAMPP.
          </p>
          <div className="card">
            <p className="small">{error.message || "Unknown error"}</p>
            <div className="btn-row mt2">
              <button className="pri" onClick={reset}>
                Try again
              </button>
              <a className="btn" href="/">
                Go home
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
