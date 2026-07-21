import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type SourceRow = { i: number; episode: string; start_s: number; end_s: number };

function ts(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function QuestionsPage() {
  const questions = await sql`
    SELECT q.id, q.question, q.answered, q.answer, q.sources, q.confidence,
           q.cost_usd, q.verdict, q.created_at, c.name AS catalog
    FROM questions q JOIN catalogs c ON c.id = q.catalog_id
    ORDER BY q.created_at DESC
    LIMIT 200
  `;
  const [counts] = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE NOT answered)::int AS gaps,
           coalesce(sum(cost_usd), 0) AS spend
    FROM questions
  `;

  return (
    <>
      <h1>Questions</h1>
      <p className="dash-sub">
        Every question fans ask, with the exact answer they received. Unanswered ones are content
        gaps; the verdict column is where evaluation lands (unrated for now).
      </p>

      <div className="stat-row">
        <div className="stat">
          <b>{counts.total}</b>
          <span>questions asked</span>
        </div>
        <div className="stat">
          <b className={counts.gaps > 0 ? "danger" : ""}>{counts.gaps}</b>
          <span>content gaps (unanswered)</span>
        </div>
        <div className="stat">
          <b>${Number(counts.spend).toFixed(4)}</b>
          <span>answer spend</span>
        </div>
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Question &amp; answer</th>
            <th>Catalog</th>
            <th>Coverage</th>
            <th>Eval</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => {
            const sources = (q.sources ?? []) as SourceRow[];
            return (
              <tr key={q.id}>
                <td style={{ maxWidth: 460 }}>
                  <div dir="auto" style={{ fontWeight: 500 }}>
                    {q.question}
                  </div>
                  {q.answer && (
                    <details style={{ marginTop: 6 }}>
                      <summary
                        className="mono"
                        style={{ cursor: "pointer", color: "var(--dim)", fontSize: 11 }}
                      >
                        answer · ${q.cost_usd != null ? Number(q.cost_usd).toFixed(4) : "—"}
                      </summary>
                      <p
                        dir="auto"
                        style={{
                          margin: "10px 0 6px",
                          fontSize: 13.5,
                          lineHeight: 1.75,
                          color: "var(--muted)",
                          whiteSpace: "pre-wrap",
                          borderInlineStart: "2px solid var(--line-2)",
                          paddingInlineStart: 12,
                        }}
                      >
                        {q.answer}
                      </p>
                      {sources.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {sources.map((s) => (
                            <span key={s.i} className="chip" title={s.episode}>
                              [{s.i}] {ts(Number(s.start_s))}–{ts(Number(s.end_s))}
                            </span>
                          ))}
                        </div>
                      )}
                    </details>
                  )}
                </td>
                <td>{q.catalog}</td>
                <td>
                  {q.answered ? (
                    <span className="chip done">
                      answered{q.confidence != null ? ` · ${Number(q.confidence).toFixed(2)}` : ""}
                    </span>
                  ) : (
                    <span className="chip failed">gap</span>
                  )}
                </td>
                <td>
                  {q.verdict ? (
                    <span className={`chip ${q.verdict === "good" ? "done" : "failed"}`}>
                      {q.verdict}
                    </span>
                  ) : (
                    <span className="chip queued">unrated</span>
                  )}
                </td>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>
                  {new Date(q.created_at).toLocaleString()}
                </td>
              </tr>
            );
          })}
          {questions.length === 0 && (
            <tr>
              <td colSpan={5} className="dash-sub">
                No questions yet — try the test chat.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
