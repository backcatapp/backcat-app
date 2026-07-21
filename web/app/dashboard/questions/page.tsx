import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const questions = await sql`
    SELECT q.id, q.question, q.answered, q.confidence, q.created_at, c.name AS catalog
    FROM questions q JOIN catalogs c ON c.id = q.catalog_id
    ORDER BY q.created_at DESC
    LIMIT 200
  `;
  const [counts] = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE NOT answered)::int AS gaps
    FROM questions
  `;

  return (
    <>
      <h1>Questions</h1>
      <p className="dash-sub">
        Every question fans ask — answered or not. Unanswered ones are content gaps: episodes the
        audience is asking for.
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
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Question</th>
            <th>Catalog</th>
            <th>Coverage</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id}>
              <td dir="auto" style={{ maxWidth: 420 }}>
                {q.question}
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
              <td className="mono" style={{ whiteSpace: "nowrap" }}>
                {new Date(q.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
          {questions.length === 0 && (
            <tr>
              <td colSpan={4} className="dash-sub">
                No questions yet — try the test chat.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
