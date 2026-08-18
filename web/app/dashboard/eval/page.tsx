import Link from "next/link";
import JudgePanel from "@/components/JudgePanel";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type PoolRow = {
  chunk_id: string;
  text: string;
  start_s: number;
  end_s: number;
  episode: string;
  source_url: string | null;
  channels: string[];
  priority: number;
  label: number | null;
  in_generated_key: boolean;
};

export default async function EvalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [progress] = await sql`
    SELECT
      (SELECT count(*) FROM eval_questions)::int AS questions,
      (SELECT count(*) FROM eval_pool)::int AS pooled,
      (SELECT count(*) FROM eval_pool WHERE priority = 1)::int AS pooled_p1,
      (SELECT count(*) FROM eval_judgments)::int AS judged,
      (SELECT count(DISTINCT question_id) FROM eval_judgments)::int AS questions_started,
      (SELECT count(*) FROM eval_judgments WHERE label >= 2)::int AS relevant
  `;

  if (progress.pooled === 0) {
    return (
      <>
        <h1>Judge relevance</h1>
        <p className="dash-sub">
          Nothing pooled yet. The queue is built from a benchmark run, so the harness knows which
          chunks each configuration actually surfaced.
        </p>
        <pre className="mono judge-empty">
          backcat-eval run --out eval/results/run.json{"\n"}
          backcat-eval import-golden{"\n"}
          backcat-eval build-pool --results eval/results/run.json
        </pre>
      </>
    );
  }

  // Next question with an unjudged priority-1 chunk. Priority 1 is the union of the
  // configs' top-5 — once it's labelled, hit@5 and MRR are fully scorable.
  const [next] = q
    ? await sql`SELECT id FROM eval_questions WHERE id = ${q}`
    : await sql`
        SELECT q.id
        FROM eval_questions q
        JOIN eval_pool p ON p.question_id = q.id AND p.priority = 1
        LEFT JOIN eval_judgments j ON j.question_id = p.question_id AND j.chunk_id = p.chunk_id
        WHERE j.label IS NULL
        GROUP BY q.id, q.category
        ORDER BY q.category, q.id
        LIMIT 1
      `;

  if (!next) {
    return (
      <>
        <h1>Judge relevance</h1>
        <p className="dash-sub">
          Every pooled chunk has a label. {progress.judged} judgments across{" "}
          {progress.questions_started} questions, {progress.relevant} marked as answering.
        </p>
        <pre className="mono judge-empty">backcat-eval rescore --results eval/results/run.json</pre>
      </>
    );
  }

  const [question] = await sql`
    SELECT q.id, q.question, q.category, c.name AS catalog
    FROM eval_questions q JOIN catalogs c ON c.id = q.catalog_id
    WHERE q.id = ${next.id}
  `;

  const items = (await sql`
    SELECT p.chunk_id, p.channels, p.priority,
           c.text, c.start_s, c.end_s,
           e.title AS episode, e.source_url,
           j.label,
           (eq.generated_chunk_ids ? p.chunk_id) AS in_generated_key
    FROM eval_pool p
    JOIN chunks c ON c.id = p.chunk_id
    JOIN episodes e ON e.id = c.episode_id
    JOIN eval_questions eq ON eq.id = p.question_id
    LEFT JOIN eval_judgments j ON j.question_id = p.question_id AND j.chunk_id = p.chunk_id
    WHERE p.question_id = ${next.id}
    ORDER BY p.priority, p.best_rank, c.start_s
  `) as unknown as PoolRow[];

  const queue = await sql`
    SELECT q.id, q.category,
           count(p.chunk_id) FILTER (WHERE p.priority = 1)::int AS pooled,
           count(j.chunk_id) FILTER (WHERE p.priority = 1)::int AS judged
    FROM eval_questions q
    JOIN eval_pool p ON p.question_id = q.id
    LEFT JOIN eval_judgments j ON j.question_id = p.question_id AND j.chunk_id = p.chunk_id
    GROUP BY q.id, q.category
    ORDER BY q.category, q.id
  `;

  return (
    <>
      <h1>Judge relevance</h1>
      <p className="dash-sub">
        The generated golden set takes its answer key from the same graph traversal the graph
        channel retrieves through, so graph configs were scored against their own index. Your call
        on whether a chunk answers the question is the one ground truth here that no retrieval
        channel had a hand in.
      </p>

      <div className="stat-row">
        <div className="stat">
          <b>
            {progress.judged}
            <span style={{ fontSize: 13, color: "var(--dim)" }}> / {progress.pooled_p1}</span>
          </b>
          <span>chunks judged (of top-5 pool)</span>
        </div>
        <div className="stat">
          <b>
            {progress.questions_started}
            <span style={{ fontSize: 13, color: "var(--dim)" }}> / {progress.questions}</span>
          </b>
          <span>questions started</span>
        </div>
        <div className="stat">
          <b>{progress.relevant}</b>
          <span>marked as answering</span>
        </div>
      </div>

      <JudgePanel
        questionId={question.id as string}
        question={question.question as string}
        category={question.category as string}
        items={items}
      />

      <div className="section">
        <h2>Queue</h2>
        <div className="judge-queue">
          {queue.map((row) => {
            const done = row.pooled > 0 && row.judged >= row.pooled;
            return (
              <Link
                key={row.id as string}
                href={`/dashboard/eval?q=${encodeURIComponent(row.id as string)}`}
                className={`chip${done ? " done" : ""}${row.id === question.id ? " running" : ""}`}
                title={row.id as string}
              >
                {row.category} {row.judged}/{row.pooled}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
