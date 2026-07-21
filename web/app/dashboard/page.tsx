import Link from "next/link";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { addYoutubeChannel } from "./actions";

export const dynamic = "force-dynamic";

type CatalogRow = {
  id: string;
  name: string;
  paused: boolean;
  episodes: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
  cost: string;
};

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.roles?.includes("admin");
  const catalogs = (await sql`
    SELECT c.id, c.name, c.paused,
      (SELECT count(*)::int FROM episodes e WHERE e.catalog_id = c.id) AS episodes,
      (SELECT count(*)::int FROM jobs j WHERE j.catalog_id = c.id AND j.status = 'queued') AS queued,
      (SELECT count(*)::int FROM jobs j WHERE j.catalog_id = c.id AND j.status = 'running') AS running,
      (SELECT count(*)::int FROM jobs j WHERE j.catalog_id = c.id AND j.status = 'done') AS done,
      (SELECT count(*)::int FROM jobs j WHERE j.catalog_id = c.id AND j.status = 'failed') AS failed,
      (SELECT coalesce(sum(cost_usd), 0) FROM cost_events ce WHERE ce.catalog_id = c.id) AS cost
    FROM catalogs c ORDER BY c.name
  `) as unknown as CatalogRow[];

  const [totals] = await sql`
    SELECT
      coalesce(sum(cost_usd), 0) AS all_time,
      coalesce(sum(cost_usd) FILTER (WHERE created_at::date = current_date), 0) AS today,
      coalesce(sum(units) FILTER (WHERE unit_kind = 'audio_hours'), 0) AS hours
    FROM cost_events
  `;
  const [kill] = await sql`SELECT value FROM app_config WHERE key = 'kill_switch'`;

  return (
    <>
      <h1>Catalogs</h1>
      <p className="dash-sub">Ingest status straight from the job table — this page is the pipeline.</p>

      {isAdmin && (
        <form
          action={addYoutubeChannel}
          className="catalog-row-actions"
          style={{ marginBottom: 24, maxWidth: 560 }}
        >
          <input
            name="channel_url"
            className="chat-input"
            style={{
              flex: 1,
              background: "var(--card)",
              border: "1px solid var(--line-2)",
              borderRadius: 10,
              padding: "9px 14px",
              fontSize: 14,
            }}
            placeholder="YouTube channel URL or @handle…"
            aria-label="YouTube channel URL"
          />
          <button className="btn" style={{ padding: "9px 16px" }}>
            Add channel
          </button>
        </form>
      )}

      <div className="stat-row">
        <div className="stat">
          <b>${Number(totals.all_time).toFixed(4)}</b>
          <span>total spend</span>
        </div>
        <div className="stat">
          <b>${Number(totals.today).toFixed(4)}</b>
          <span>spend today</span>
        </div>
        <div className="stat">
          <b>{Number(totals.hours).toFixed(2)}h</b>
          <span>audio transcribed</span>
        </div>
        <div className="stat">
          <b className={kill?.value === true ? "danger" : ""}>{kill?.value === true ? "ON" : "off"}</b>
          <span>kill-switch</span>
        </div>
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Catalog</th>
            <th>Episodes</th>
            <th>Jobs</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {catalogs.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/dashboard/catalogs/${c.id}`}>{c.name}</Link>
                {c.paused && <span className="chip failed">paused</span>}
              </td>
              <td className="mono">{c.episodes}</td>
              <td>
                {c.queued > 0 && <span className="chip queued">{c.queued} queued</span>}
                {c.running > 0 && <span className="chip running">{c.running} running</span>}
                {c.done > 0 && <span className="chip done">{c.done} done</span>}
                {c.failed > 0 && <span className="chip failed">{c.failed} failed</span>}
              </td>
              <td className="mono">${Number(c.cost).toFixed(4)}</td>
            </tr>
          ))}
          {catalogs.length === 0 && (
            <tr>
              <td colSpan={4} className="dash-sub">
                No catalogs yet — <code>ingest add &lt;rss_url&gt;</code>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
