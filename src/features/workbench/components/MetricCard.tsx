export function MetricCard({ n, t }: { n: number; t: string }) {
  return (
    <article className="metric-card">
      <small>{t}</small>
      <strong>{n}</strong>
    </article>
  );
}
