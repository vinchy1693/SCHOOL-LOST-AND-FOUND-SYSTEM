export default function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div className={`flash ${err ? "err" : "ok"}`} role="status">
      <span aria-hidden="true">{err ? "⚠️" : "✅"}</span>
      <span>{err || ok}</span>
    </div>
  );
}
