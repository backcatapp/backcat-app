import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.roles?.includes("admin")) redirect("/dashboard");
  const { q } = await searchParams;
  const needle = (q ?? "").trim().toLowerCase();

  const users = await sql`
    SELECT u.id, u.email, u.display_name, u.extra_credits, u.byok_last4, u.created_at,
      (SELECT count(*)::int FROM user_catalogs uc WHERE uc.user_id = u.id AND uc.kind = 'saved') AS saved,
      (SELECT count(*)::int FROM user_catalogs uc WHERE uc.user_id = u.id AND uc.kind = 'owned') AS owned,
      (SELECT count(*)::int FROM questions qu WHERE qu.user_id = u.id) AS asks,
      (SELECT max(qu.created_at) FROM questions qu WHERE qu.user_id = u.id) AS last_ask,
      EXISTS (
        SELECT 1 FROM user_catalogs uc
        JOIN chunks ch ON ch.catalog_id = uc.catalog_id
        WHERE uc.user_id = u.id
      ) AS has_indexed,
      (SELECT count(*)::int FROM credit_requests cr
        WHERE cr.user_id = u.id AND cr.status = 'open') AS open_credits
    FROM users u
    WHERE ${needle || null}::text IS NULL OR lower(u.email) LIKE ${needle ? `%${needle}%` : null}
    ORDER BY u.created_at DESC
    LIMIT 200
  `;

  const waitlistOnly = await sql`
    SELECT w.id, w.email, w.feed_url, w.created_at, w.sample_question
    FROM waitlist w
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email))
      AND (${needle || null}::text IS NULL OR lower(w.email) LIKE ${needle ? `%${needle}%` : null})
    ORDER BY w.created_at DESC
    LIMIT 100
  `;

  const [openCredits] = await sql`
    SELECT count(*)::int AS n FROM credit_requests WHERE status = 'open'
  `;

  function stage(u: (typeof users)[0]): string {
    if (Number(u.asks) > 0) return "asked";
    if (u.has_indexed) return "indexed";
    if (Number(u.saved) > 0 || Number(u.owned) > 0) return "saved";
    return "signed_up";
  }

  return (
    <>
      <h1>Users</h1>
      <p className="dash-sub">
        Extension users + waitlist not yet signed in.
        {openCredits.n > 0 && (
          <>
            {" "}
            <span className="chip failed">{openCredits.n} open credit requests</span>
          </>
        )}
      </p>

      <form method="get" style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search email…"
          className="chat-input"
          style={{
            flex: 1,
            maxWidth: 360,
            background: "var(--card)",
            border: "1px solid var(--line-2)",
            borderRadius: 10,
            padding: "9px 14px",
          }}
        />
        <button className="btn-ghost" type="submit">
          Search
        </button>
      </form>

      <table className="dash-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Stage</th>
            <th>Lists</th>
            <th>Asks</th>
            <th>Credits</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <Link href={`/dashboard/users/${u.id}`}>{u.email}</Link>
                {u.display_name && (
                  <div className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
                    {u.display_name}
                  </div>
                )}
                {Number(u.open_credits) > 0 && (
                  <span className="chip failed" style={{ marginTop: 4 }}>
                    wants credits
                  </span>
                )}
              </td>
              <td>
                <span className="chip">{stage(u)}</span>
              </td>
              <td className="mono">
                {u.saved}s / {u.owned}o
              </td>
              <td className="mono">{u.asks}</td>
              <td className="mono">
                {u.extra_credits}
                {u.byok_last4 ? ` · BYOK …${u.byok_last4}` : ""}
              </td>
              <td className="mono" style={{ fontSize: 12 }}>
                {new Date(u.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {waitlistOnly.map((w) => (
            <tr key={`w-${w.id}`}>
              <td>
                {w.email}
                <div className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
                  waitlist only
                  {w.feed_url ? ` · ${w.feed_url}` : ""}
                </div>
              </td>
              <td>
                <span className="chip">waitlist</span>
              </td>
              <td colSpan={3} className="dash-sub" style={{ margin: 0 }}>
                {w.sample_question || "—"}
              </td>
              <td className="mono" style={{ fontSize: 12 }}>
                {new Date(w.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {users.length === 0 && waitlistOnly.length === 0 && (
            <tr>
              <td colSpan={6} className="dash-sub">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
