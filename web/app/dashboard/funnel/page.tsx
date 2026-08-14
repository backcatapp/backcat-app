import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const session = await auth();
  if (!session?.roles?.includes("admin")) redirect("/dashboard");
  const { w: rawW } = await searchParams;
  const w = rawW === "7d" || rawW === "30d" ? rawW : "all";

  const waitlist =
    w === "all"
      ? await sql`SELECT count(*)::int AS n FROM waitlist`
      : w === "7d"
        ? await sql`SELECT count(*)::int AS n FROM waitlist WHERE created_at >= now() - interval '7 days'`
        : await sql`SELECT count(*)::int AS n FROM waitlist WHERE created_at >= now() - interval '30 days'`;

  const signedUp =
    w === "all"
      ? await sql`SELECT count(*)::int AS n FROM users`
      : w === "7d"
        ? await sql`SELECT count(*)::int AS n FROM users WHERE created_at >= now() - interval '7 days'`
        : await sql`SELECT count(*)::int AS n FROM users WHERE created_at >= now() - interval '30 days'`;

  const saved =
    w === "all"
      ? await sql`
          SELECT count(DISTINCT user_id)::int AS n FROM user_catalogs WHERE kind = 'saved'
        `
      : w === "7d"
        ? await sql`
            SELECT count(DISTINCT user_id)::int AS n FROM user_catalogs
            WHERE kind = 'saved' AND created_at >= now() - interval '7 days'
          `
        : await sql`
            SELECT count(DISTINCT user_id)::int AS n FROM user_catalogs
            WHERE kind = 'saved' AND created_at >= now() - interval '30 days'
          `;

  const indexedRows =
    w === "all"
      ? await sql`
          SELECT count(DISTINCT uc.user_id)::int AS n
          FROM user_catalogs uc
          WHERE EXISTS (SELECT 1 FROM chunks ch WHERE ch.catalog_id = uc.catalog_id)
        `
      : w === "7d"
        ? await sql`
            SELECT count(DISTINCT uc.user_id)::int AS n
            FROM user_catalogs uc
            JOIN users u ON u.id = uc.user_id
            WHERE EXISTS (SELECT 1 FROM chunks ch WHERE ch.catalog_id = uc.catalog_id)
              AND u.created_at >= now() - interval '7 days'
          `
        : await sql`
            SELECT count(DISTINCT uc.user_id)::int AS n
            FROM user_catalogs uc
            JOIN users u ON u.id = uc.user_id
            WHERE EXISTS (SELECT 1 FROM chunks ch WHERE ch.catalog_id = uc.catalog_id)
              AND u.created_at >= now() - interval '30 days'
          `;

  const asked =
    w === "all"
      ? await sql`SELECT count(DISTINCT user_id)::int AS n FROM questions WHERE user_id IS NOT NULL`
      : w === "7d"
        ? await sql`
            SELECT count(DISTINCT user_id)::int AS n FROM questions
            WHERE user_id IS NOT NULL AND created_at >= now() - interval '7 days'
          `
        : await sql`
            SELECT count(DISTINCT user_id)::int AS n FROM questions
            WHERE user_id IS NOT NULL AND created_at >= now() - interval '30 days'
          `;

  const converted =
    w === "all"
      ? await sql`
          SELECT count(*)::int AS n FROM waitlist w
          WHERE EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email))
        `
      : w === "7d"
        ? await sql`
            SELECT count(*)::int AS n FROM waitlist w
            WHERE w.created_at >= now() - interval '7 days'
              AND EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email))
          `
        : await sql`
            SELECT count(*)::int AS n FROM waitlist w
            WHERE w.created_at >= now() - interval '30 days'
              AND EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email))
          `;

  const steps = [
    { key: "waitlist", label: "Waitlist", n: waitlist[0].n },
    { key: "signed_up", label: "Signed up", n: signedUp[0].n },
    { key: "saved", label: "Saved channel", n: saved[0].n },
    { key: "indexed", label: "Has indexed catalog", n: indexedRows[0].n },
    { key: "asked", label: "Asked", n: asked[0].n },
  ];
  const maxN = Math.max(1, ...steps.map((s) => s.n));

  const dailyWait =
    w === "7d"
      ? await sql`
          SELECT created_at::date AS d, count(*)::int AS n
          FROM waitlist WHERE created_at >= now() - interval '7 days'
          GROUP BY 1 ORDER BY 1
        `
      : await sql`
          SELECT created_at::date AS d, count(*)::int AS n
          FROM waitlist WHERE created_at >= now() - interval '30 days'
          GROUP BY 1 ORDER BY 1
        `;
  const dailyUsers =
    w === "7d"
      ? await sql`
          SELECT created_at::date AS d, count(*)::int AS n
          FROM users WHERE created_at >= now() - interval '7 days'
          GROUP BY 1 ORDER BY 1
        `
      : await sql`
          SELECT created_at::date AS d, count(*)::int AS n
          FROM users WHERE created_at >= now() - interval '30 days'
          GROUP BY 1 ORDER BY 1
        `;
  const barMax = Math.max(
    1,
    ...dailyWait.map((r) => r.n),
    ...dailyUsers.map((r) => r.n),
  );

  return (
    <>
      <h1>Funnel</h1>
      <p className="dash-sub">
        Waitlist → signup → save → index → ask.
        {converted[0].n > 0 && (
          <>
            {" "}
            {converted[0].n} waitlist emails matched a signed-in user.
          </>
        )}
      </p>

      <div className="filter-pills" style={{ marginBottom: 20 }}>
        {(["7d", "30d", "all"] as const).map((opt) => (
          <Link
            key={opt}
            href={`/dashboard/funnel?w=${opt}`}
            className={`pill ${w === opt ? "active" : ""}`}
          >
            {opt === "all" ? "All time" : opt}
          </Link>
        ))}
      </div>

      <div className="funnel-steps">
        {steps.map((s, i) => {
          const prev = i === 0 ? s.n : steps[i - 1].n;
          const pct = prev > 0 ? Math.round((s.n / prev) * 100) : 0;
          return (
            <div key={s.key} className="funnel-step">
              <div className="funnel-label">
                <span>{s.label}</span>
                <b>{s.n}</b>
                {i > 0 && <span className="mono dim">{pct}% of prior</span>}
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(s.n / maxN) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 16, margin: "32px 0 12px" }}>Daily signups</h2>
      <div className="chart-bars">
        {dailyUsers.map((r) => (
          <div key={String(r.d)} className="chart-col" title={`${r.d}: ${r.n} users`}>
            <div className="chart-bar" style={{ height: `${(r.n / barMax) * 100}%` }} />
            <span className="chart-x">{String(r.d).slice(5)}</span>
          </div>
        ))}
        {dailyUsers.length === 0 && <p className="dash-sub">No signups in window.</p>}
      </div>

      <h2 style={{ fontSize: 16, margin: "32px 0 12px" }}>Daily waitlist</h2>
      <div className="chart-bars">
        {dailyWait.map((r) => (
          <div key={String(r.d)} className="chart-col" title={`${r.d}: ${r.n} waitlist`}>
            <div
              className="chart-bar accent2"
              style={{ height: `${(r.n / barMax) * 100}%` }}
            />
            <span className="chart-x">{String(r.d).slice(5)}</span>
          </div>
        ))}
        {dailyWait.length === 0 && <p className="dash-sub">No waitlist joins in window.</p>}
      </div>
    </>
  );
}
