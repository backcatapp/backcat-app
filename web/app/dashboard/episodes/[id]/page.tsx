import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function ts(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Transcripts and raw chunks are internal material — admin only for now.
  const session = await auth();
  if (!session?.roles?.includes("admin")) redirect("/dashboard");

  const [episode] = await sql`
    SELECT e.id, e.title, e.catalog_id, c.name AS catalog_name,
           t.language, t.audio_duration_s, t.model, t.text
    FROM episodes e
    JOIN catalogs c ON c.id = e.catalog_id
    LEFT JOIN transcripts t ON t.episode_id = e.id
    WHERE e.id = ${id}
  `;
  if (!episode) notFound();

  const chunks = await sql`
    SELECT ch.id, ch.start_s, ch.end_s, ch.text,
           (emb.chunk_id IS NOT NULL) AS embedded
    FROM chunks ch
    LEFT JOIN embeddings_openai_3small emb ON emb.chunk_id = ch.id
    WHERE ch.episode_id = ${id}
    ORDER BY ch.start_s
  `;

  return (
    <>
      <h1>{episode.title}</h1>
      <p className="dash-sub">
        {episode.catalog_name}
        {episode.language && (
          <>
            {" · "}
            <span className="mono">
              {episode.language} · {ts(Number(episode.audio_duration_s))} · {episode.model}
            </span>
          </>
        )}
      </p>

      {!episode.text && <p className="dash-sub">Not transcribed yet.</p>}

      {chunks.length > 0 && (
        <div className="section">
          <h2>
            Chunks <span className="mono" style={{ color: "var(--dim)" }}>({chunks.length})</span>
          </h2>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Window</th>
                <th>Text</th>
                <th>Embedded</th>
              </tr>
            </thead>
            <tbody>
              {chunks.map((ch) => (
                <tr key={ch.id}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>
                    {ts(Number(ch.start_s))} – {ts(Number(ch.end_s))}
                  </td>
                  <td style={{ fontSize: 13, lineHeight: 1.6 }}>{ch.text}</td>
                  <td className="mono">{ch.embedded ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {episode.text && (
        <div className="section">
          <h2>Full transcript</h2>
          <details>
            <summary className="dash-sub" style={{ cursor: "pointer" }}>
              show / hide
            </summary>
            <p style={{ fontSize: 14, lineHeight: 1.8, maxWidth: 760, whiteSpace: "pre-wrap" }}>
              {episode.text}
            </p>
          </details>
        </div>
      )}
    </>
  );
}
