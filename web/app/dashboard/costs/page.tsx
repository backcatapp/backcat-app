import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const session = await auth();
  if (!session?.roles?.includes("admin")) redirect("/dashboard");
  const { w: rawW } = await searchParams;
  const w = rawW === "7d" || rawW === "30d" || rawW === "today" ? rawW : "30d";

  const [totals] = await sql`
    SELECT
      coalesce(sum(cost_usd), 0) AS all_time,
      coalesce(sum(cost_usd) FILTER (WHERE created_at::date = current_date), 0) AS today,
      coalesce(sum(cost_usd) FILTER (WHERE created_at >= now() - interval '7 days'), 0) AS d7,
      coalesce(sum(cost_usd) FILTER (WHERE created_at >= now() - interval '30 days'), 0) AS d30
    FROM cost_events
  `;

  const daily =
    w === "today"
      ? await sql`
          SELECT date_trunc('hour', created_at) AS d, coalesce(sum(cost_usd), 0) AS n
          FROM cost_events WHERE created_at::date = current_date
          GROUP BY 1 ORDER BY 1
        `
      : w === "7d"
        ? await sql`
            SELECT created_at::date AS d, coalesce(sum(cost_usd), 0) AS n
            FROM cost_events WHERE created_at >= now() - interval '7 days'
            GROUP BY 1 ORDER BY 1
          `
        : await sql`
            SELECT created_at::date AS d, coalesce(sum(cost_usd), 0) AS n
            FROM cost_events WHERE created_at >= now() - interval '30 days'
            GROUP BY 1 ORDER BY 1
          `;

  const byService =
    w === "today"
      ? await sql`
          SELECT service, coalesce(sum(cost_usd), 0) AS n
          FROM cost_events WHERE created_at::date = current_date
          GROUP BY 1 ORDER BY n DESC
        `
      : w === "7d"
        ? await sql`
            SELECT service, coalesce(sum(cost_usd), 0) AS n
            FROM cost_events WHERE created_at >= now() - interval '7 days'
            GROUP BY 1 ORDER BY n DESC
          `
        : await sql`
            SELECT service, coalesce(sum(cost_usd), 0) AS n
            FROM cost_events WHERE created_at >= now() - interval '30 days'
            GROUP BY 1 ORDER BY n DESC
          `;

  const byCatalog =
    w === "today"
      ? await sql`
          SELECT c.id, c.name, coalesce(sum(ce.cost_usd), 0) AS n
          FROM cost_events ce
          JOIN catalogs c ON c.id = ce.catalog_id
          WHERE ce.created_at::date = current_date
          GROUP BY c.id ORDER BY n DESC LIMIT 20
        `
      : w === "7d"
        ? await sql`
            SELECT c.id, c.name, coalesce(sum(ce.cost_usd), 0) AS n
            FROM cost_events ce
            JOIN catalogs c ON c.id = ce.catalog_id
            WHERE ce.created_at >= now() - interval '7 days'
            GROUP BY c.id ORDER BY n DESC LIMIT 20
          `
        : await sql`
            SELECT c.id, c.name, coalesce(sum(ce.cost_usd), 0) AS n
            FROM cost_events ce
            JOIN catalogs c ON c.id = ce.catalog_id
            WHERE ce.created_at >= now() - interval '30 days'
            GROUP BY c.id ORDER BY n DESC LIMIT 20
          `;

  const dayMax = Math.max(0.0001, ...daily.map((r) => Number(r.n)));
  const svcMax = Math.max(0.0001, ...byService.map((r) => Number(r.n)));

  return (
    <>
      <h1>Costs</h1>
      <p className="dash-sub">Spend from cost_events — ASR, embeddings, LLM extraction & asks.</p>

      <div className="stat-row">
        <div className="stat">
          <b>${Number(totals.today).toFixed(4)}</b>
          <span>today</span>
        </div>
        <div className="stat">
          <b>${Number(totals.d7).toFixed(4)}</b>
          <span>7 days</span>
        </div>
        <div className="stat">
          <b>${Number(totals.d30).toFixed(4)}</b>
          <span>30 days</span>
        </div>
        <div className="stat">
          <b>${Number(totals.all_time).toFixed(4)}</b>
          <span>all time</span>
        </div>
      </div>

      <div className="filter-pills" style={{ marginBottom: 20 }}>
        {(["today", "7d", "30d"] as const).map((opt) => (
          <Link
            key={opt}
            href={`/dashboard/costs?w=${opt}`}
            className={`pill ${w === opt ? "active" : ""}`}
          >
            {opt}
          </Link>
        ))}
      </div>

      <h2 style={{ fontSize: 16, margin: "8px 0 12px" }}>
        {w === "today" ? "Hourly spend" : "Daily spend"}
      </h2>
      <div className="chart-bars tall">
        {daily.map((r) => (
          <div
            key={String(r.d)}
            className="chart-col"
            title={`${r.d}: $${Number(r.n).toFixed(4)}`}
          >
            <div
              className="chart-bar"
              style={{ height: `${(Number(r.n) / dayMax) * 100}%` }}
            />
            <span className="chart-x">
              {w === "today"
                ? String(r.d).slice(11, 16)
                : String(r.d).slice(5)}
            </span>
          </div>
        ))}
        {daily.length === 0 && <p className="dash-sub">No spend in window.</p>}
      </div>

      <h2 style={{ fontSize: 16, margin: "32px 0 12px" }}>By service</h2>
      <div className="funnel-steps">
        {byService.map((s) => (
          <div key={s.service} className="funnel-step">
            <div className="funnel-label">
              <span className="mono">{s.service}</span>
              <b>${Number(s.n).toFixed(4)}</b>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(Number(s.n) / svcMax) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {byService.length === 0 && <p className="dash-sub">No events.</p>}
      </div>

      <h2 style={{ fontSize: 16, margin: "32px 0 12px" }}>Top catalogs</h2>
      <table className="dash-table">
        <thead>
          <tr>
            <th>Catalog</th>
            <th>Spend</th>
          </tr>
        </thead>
        <tbody>
          {byCatalog.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/dashboard/catalogs/${c.id}`}>{c.name}</Link>
              </td>
              <td className="mono">${Number(c.n).toFixed(4)}</td>
            </tr>
          ))}
          {byCatalog.length === 0 && (
            <tr>
              <td colSpan={2} className="dash-sub">
                No catalog spend.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
