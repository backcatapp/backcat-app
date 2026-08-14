import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import {
  adminUnsaveCatalog,
  clearUserByok,
  fulfillCreditRequest,
  retryJob,
  setCreditRequestStatus,
  setUserCredits,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.roles?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const [user] = await sql`
    SELECT id, email, display_name, extra_credits, byok_last4, created_at, updated_at
    FROM users WHERE id = ${id}
  `;
  if (!user) notFound();

  const catalogs = await sql`
    SELECT c.id, c.name, uc.kind, uc.created_at,
      (SELECT count(*)::int FROM episodes e WHERE e.catalog_id = c.id) AS episodes,
      (SELECT count(*)::int FROM chunks ch WHERE ch.catalog_id = c.id) AS chunks
    FROM user_catalogs uc
    JOIN catalogs c ON c.id = uc.catalog_id
    WHERE uc.user_id = ${id}
    ORDER BY uc.created_at DESC
  `;

  const failedJobs = await sql`
    SELECT j.id, j.stage, j.error, j.finished_at, e.title AS episode, c.name AS catalog
    FROM jobs j
    JOIN episodes e ON e.id = j.episode_id
    JOIN catalogs c ON c.id = j.catalog_id
    WHERE j.status = 'failed'
      AND (
        j.requested_by = ${id}
        OR j.catalog_id IN (SELECT catalog_id FROM user_catalogs WHERE user_id = ${id})
      )
    ORDER BY j.finished_at DESC NULLS LAST
    LIMIT 30
  `;

  const events = await sql`
    SELECT event, props, created_at
    FROM user_events
    WHERE user_id = ${id} OR lower(email) = lower(${user.email})
    ORDER BY created_at DESC
    LIMIT 40
  `;

  const questions = await sql`
    SELECT id, question, answered, debit_mode, created_at, catalog_id
    FROM questions WHERE user_id = ${id}
    ORDER BY created_at DESC LIMIT 20
  `;

  const creditReqs = await sql`
    SELECT id, note, status, created_at, updated_at
    FROM credit_requests
    WHERE user_id = ${id} OR lower(email) = lower(${user.email})
    ORDER BY created_at DESC
  `;

  return (
    <>
      <p className="dash-sub" style={{ marginBottom: 8 }}>
        <Link href="/dashboard/users">← Users</Link>
      </p>
      <h1>{user.email}</h1>
      <p className="dash-sub">
        {user.display_name || "No display name"} · joined{" "}
        {new Date(user.created_at).toLocaleString()}
      </p>

      <div className="stat-row">
        <div className="stat">
          <b>{user.extra_credits}</b>
          <span>extra credits</span>
        </div>
        <div className="stat">
          <b>{user.byok_last4 ? `…${user.byok_last4}` : "—"}</b>
          <span>BYOK</span>
        </div>
        <div className="stat">
          <b>{catalogs.length}</b>
          <span>list links</span>
        </div>
        <div className="stat">
          <b>{questions.length}+</b>
          <span>recent asks</span>
        </div>
      </div>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Wallet actions</h2>
        <form action={setUserCredits.bind(null, id)} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            name="extra_credits"
            type="number"
            min={0}
            defaultValue={user.extra_credits}
            className="chat-input"
            style={{
              width: 120,
              background: "var(--card)",
              border: "1px solid var(--line-2)",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          />
          <button className="btn" type="submit">
            Set credits
          </button>
        </form>
        {user.byok_last4 && (
          <form action={clearUserByok.bind(null, id)}>
            <button className="btn-ghost" type="submit">
              Clear BYOK
            </button>
          </form>
        )}
      </section>

      {creditReqs.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Credit requests</h2>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Note</th>
                <th>When</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {creditReqs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`chip ${r.status === "open" ? "failed" : "done"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.note || "—"}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(["contacted", "closed"] as const).map((st) => (
                        <form key={st} action={setCreditRequestStatus.bind(null, String(r.id))}>
                          <input type="hidden" name="status" value={st} />
                          <button className="btn-ghost" type="submit">
                            {st}
                          </button>
                        </form>
                      ))}
                      {r.status === "open" && (
                        <form
                          action={fulfillCreditRequest.bind(null, String(r.id))}
                          style={{ display: "flex", gap: 4 }}
                        >
                          <input
                            name="grant_credits"
                            type="number"
                            min={1}
                            defaultValue={20}
                            style={{ width: 64, padding: "4px 6px" }}
                          />
                          <button className="btn" type="submit">
                            Grant & fulfill
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Lists</h2>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Catalog</th>
              <th>Kind</th>
              <th>Eps / chunks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {catalogs.map((c) => (
              <tr key={`${c.id}-${c.kind}`}>
                <td>
                  <Link href={`/dashboard/catalogs/${c.id}`}>{c.name}</Link>
                </td>
                <td className="mono">{c.kind}</td>
                <td className="mono">
                  {c.episodes} / {c.chunks}
                </td>
                <td>
                  {c.kind === "saved" && (
                    <form action={adminUnsaveCatalog.bind(null, id, c.id as string)}>
                      <button className="btn-ghost" type="submit">
                        Unsave
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {catalogs.length === 0 && (
              <tr>
                <td colSpan={4} className="dash-sub">
                  No catalogs linked.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {failedJobs.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Failed jobs</h2>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Episode</th>
                <th>Stage</th>
                <th>Error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {failedJobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <div dir="auto">{j.episode}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
                      {j.catalog}
                    </div>
                  </td>
                  <td className="mono">{j.stage}</td>
                  <td>
                    <details>
                      <summary className="err" style={{ cursor: "pointer", fontSize: 12 }}>
                        error
                      </summary>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>{j.error}</pre>
                    </details>
                  </td>
                  <td>
                    <form action={retryJob.bind(null, j.id as string)}>
                      <button className="btn-ghost" type="submit">
                        Retry
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Recent asks</h2>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Debit</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td dir="auto">
                  {q.question}
                  {!q.answered && (
                    <span className="chip" style={{ marginInlineStart: 6 }}>
                      absence
                    </span>
                  )}
                </td>
                <td className="mono">{q.debit_mode || "—"}</td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {new Date(q.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr>
                <td colSpan={3} className="dash-sub">
                  No asks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Activity</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {events.map((e, i) => (
            <li
              key={i}
              style={{
                padding: "8px 0",
                borderBottom: "1px solid var(--line)",
                fontSize: 13,
              }}
            >
              <span className="chip">{e.event}</span>{" "}
              <span className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
                {new Date(e.created_at).toLocaleString()}
              </span>
              {e.props && Object.keys(e.props as object).length > 0 && (
                <pre
                  className="mono"
                  style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0" }}
                >
                  {JSON.stringify(e.props)}
                </pre>
              )}
            </li>
          ))}
          {events.length === 0 && <li className="dash-sub">No events yet.</li>}
        </ul>
      </section>
    </>
  );
}
