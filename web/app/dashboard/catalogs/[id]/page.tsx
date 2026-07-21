import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { retryFailed, reindexTranscribe, togglePause } from "../../actions";

export const dynamic = "force-dynamic";

type JobCell = { stage: string; status: string; attempts: number; error: string | null };

export default async function CatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.roles?.includes("admin");

  const [catalog] = await sql`SELECT id, name, rss_url, paused FROM catalogs WHERE id = ${id}`;
  if (!catalog) notFound();

  const episodes = await sql`
    SELECT e.id, e.title, e.published_at, e.duration_s,
      coalesce(json_agg(json_build_object(
        'stage', j.stage, 'status', j.status, 'attempts', j.attempt_count, 'error', j.error
      ) ORDER BY j.stage) FILTER (WHERE j.id IS NOT NULL), '[]') AS jobs,
      (SELECT coalesce(sum(cost_usd), 0) FROM cost_events ce WHERE ce.episode_id = e.id) AS cost
    FROM episodes e
    LEFT JOIN jobs j ON j.episode_id = e.id
    WHERE e.catalog_id = ${id}
    GROUP BY e.id
    ORDER BY e.published_at DESC NULLS LAST
  `;

  return (
    <>
      <h1>{catalog.name}</h1>
      <p className="dash-sub mono">{catalog.rss_url}</p>

      {isAdmin && (
        <div className="catalog-row-actions" style={{ marginBottom: 24 }}>
          <form action={retryFailed.bind(null, id)}>
            <button className="btn-ghost">Retry failed</button>
          </form>
          <form action={reindexTranscribe.bind(null, id)}>
            <button className="btn-ghost">Re-index (transcribe)</button>
          </form>
          <form action={togglePause.bind(null, id)}>
            <button className="btn-ghost">{catalog.paused ? "Resume" : "Pause"}</button>
          </form>
        </div>
      )}

      <table className="dash-table">
        <thead>
          <tr>
            <th>Episode</th>
            <th>Duration</th>
            <th>Stages</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {episodes.map((e) => {
            const jobs = e.jobs as unknown as JobCell[];
            const firstError = jobs.find((j) => j.error)?.error;
            return (
              <tr key={e.id}>
                <td>
                  {e.title}
                  {firstError && <div className="err">{firstError}</div>}
                </td>
                <td className="mono">{e.duration_s ? `${Math.round(Number(e.duration_s))}s` : "—"}</td>
                <td>
                  {jobs.map((j) => (
                    <span key={j.stage} className={`chip ${j.status}`}>
                      {j.stage}: {j.status}
                      {j.attempts > 1 ? ` (${j.attempts})` : ""}
                    </span>
                  ))}
                </td>
                <td className="mono">${Number(e.cost).toFixed(4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
