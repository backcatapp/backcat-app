import { auth } from "@/auth";
import AutoRefresh from "@/components/AutoRefresh";
import { sql } from "@/lib/db";
import { retryJob } from "../actions";

export const dynamic = "force-dynamic";

function dur(start?: string | Date | null, end?: string | Date | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const secs = Math.max(0, (e - s) / 1000);
  if (secs < 90) return `${secs.toFixed(secs < 10 ? 1 : 0)}s`;
  return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ episode?: string; catalog?: string }>;
}) {
  const { episode: episodeFilter, catalog: catalogFilter } = await searchParams;
  const session = await auth();
  const isAdmin = session?.roles?.includes("admin");

  const jobs = await sql`
    SELECT j.id, j.stage, j.status, j.attempt_count, j.error, j.started_at, j.finished_at,
           j.logs, e.title AS episode, c.name AS catalog
    FROM jobs j
    JOIN episodes e ON e.id = j.episode_id
    JOIN catalogs c ON c.id = j.catalog_id
    WHERE (${episodeFilter ?? null}::text IS NULL OR j.episode_id = ${episodeFilter ?? null})
      AND (${catalogFilter ?? null}::text IS NULL OR j.catalog_id = ${catalogFilter ?? null})
    ORDER BY
      CASE j.status WHEN 'running' THEN 0 WHEN 'failed' THEN 1 WHEN 'queued' THEN 2 ELSE 3 END,
      coalesce(j.finished_at, j.started_at) DESC NULLS LAST
    LIMIT 150
  `;
  const [counts] = await sql`
    SELECT count(*) FILTER (WHERE status = 'queued')::int AS queued,
           count(*) FILTER (WHERE status = 'running')::int AS running,
           count(*) FILTER (WHERE status = 'failed')::int AS failed,
           count(*) FILTER (WHERE status = 'done')::int AS done
    FROM jobs
  `;
  const [hb] = await sql`SELECT value, updated_at FROM app_config WHERE key = 'worker.last_seen'`;
  const hbAge = hb ? (Date.now() - new Date(hb.updated_at).getTime()) / 1000 : null;
  const workerAlive = hbAge !== null && hbAge < 30;
  const active = counts.queued > 0 || counts.running > 0;

  return (
    <>
      <AutoRefresh active={active} />
      <h1>Jobs</h1>
      {(episodeFilter || catalogFilter) && jobs.length > 0 && (
        <p className="dash-sub">
          filtered to {episodeFilter ? <b dir="auto">{jobs[0].episode}</b> : <b>{jobs[0].catalog}</b>}{" "}
          — <a href="/dashboard/jobs">show all</a>
        </p>
      )}
      <p className="dash-sub">
        Every pipeline stage as it runs — this table IS the queue.{" "}
        {workerAlive ? (
          <span className="chip done">worker active · {Math.round(hbAge!)}s ago</span>
        ) : (
          <span className="chip failed" title="Run: pipeline\.venv\Scripts\ingest worker --interval 5">
            worker offline — queued jobs will not process
          </span>
        )}
      </p>

      <div className="stat-row">
        <div className="stat">
          <b>{counts.running}</b>
          <span>running</span>
        </div>
        <div className="stat">
          <b>{counts.queued}</b>
          <span>queued</span>
        </div>
        <div className="stat">
          <b className={counts.failed > 0 ? "danger" : ""}>{counts.failed}</b>
          <span>failed</span>
        </div>
        <div className="stat">
          <b>{counts.done}</b>
          <span>done</span>
        </div>
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Episode</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td style={{ maxWidth: 340 }}>
                <div dir="auto" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {j.episode}
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
                  {j.catalog}
                </div>
              </td>
              <td className="mono">{j.stage}</td>
              <td>
                <span className={`chip ${j.status}`}>
                  {j.status}
                  {j.attempt_count > 1 ? ` (${j.attempt_count})` : ""}
                </span>
                {j.error && (
                  <details style={{ marginTop: 4, maxWidth: 380 }}>
                    <summary className="mono" style={{ fontSize: 11, color: "#e24b4a", cursor: "pointer" }}>
                      error
                    </summary>
                    <p className="err" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{j.error}</p>
                  </details>
                )}
                {isAdmin && j.logs && (
                  <details
                    open={j.status === "running"}
                    style={{ marginTop: 4, maxWidth: 420 }}
                  >
                    <summary className="mono" style={{ fontSize: 11, color: "var(--dim)", cursor: "pointer" }}>
                      logs
                    </summary>
                    <pre
                      className="mono"
                      style={{
                        fontSize: 11, lineHeight: 1.7, color: "var(--muted)",
                        whiteSpace: "pre-wrap", margin: "6px 0 0",
                        borderInlineStart: "2px solid var(--line-2)", paddingInlineStart: 10,
                      }}
                    >
                      {j.logs}
                    </pre>
                  </details>
                )}
              </td>
              <td className="mono" style={{ whiteSpace: "nowrap" }}>
                {j.status === "running" ? `${dur(j.started_at, null)} …` : dur(j.started_at, j.finished_at)}
              </td>
              <td>
                {isAdmin && (j.status === "failed" || j.status === "done") && (
                  <form action={retryJob.bind(null, j.id as string)}>
                    <button className="btn-ghost">{j.status === "failed" ? "Retry" : "Re-run"}</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={5} className="dash-sub">
                No jobs yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
