import { TYPE_COLORS } from "./ConceptGraph";

type Topic = {
  name: string;
  label: string;
  mentions: number;
  windows: { start_s: number; end_s: number }[];
};

type Category = { name: string; topics: Topic[] };

function ts(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function TopicRows({ topics, duration }: { topics: Topic[]; duration: number }) {
  const rows = topics.slice(0, 8);
  const W = 640;
  const ROW = 26;
  const H = rows.length * ROW;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", maxWidth: 900 }}>
      <div>
        {rows.map((t) => (
          <div
            key={t.name}
            dir="auto"
            title={`${t.name} — ${t.mentions} mentions`}
            style={{
              height: ROW, display: "flex", alignItems: "center", gap: 7,
              fontSize: 12.5, color: "var(--muted)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", paddingInlineEnd: 12,
            }}
          >
            <i
              style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: TYPE_COLORS[t.label] ?? "#e06a1f",
              }}
            />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
          </div>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block", minWidth: 420 }}
          role="img"
          aria-label="Topic mentions across the episode"
        >
          {[0.25, 0.5, 0.75].map((f, i) => (
            <line key={i} x1={f * W} x2={f * W} y1={0} y2={H} stroke="var(--line)" strokeWidth={1} />
          ))}
          {rows.map((t, r) =>
            t.windows.map((w, i) => {
              const x = (w.start_s / duration) * W;
              const width = Math.max(((w.end_s - w.start_s) / duration) * W - 2, 3);
              return (
                <rect
                  key={`${r}-${i}`}
                  x={x}
                  y={r * ROW + 7}
                  width={width}
                  height={ROW - 14}
                  rx={4}
                  fill={TYPE_COLORS[t.label] ?? "#e06a1f"}
                >
                  <title>
                    {t.name} · {ts(w.start_s)}–{ts(w.end_s)}
                  </title>
                </rect>
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}

/** Two-level topics: category chips ("this episode in a few words") on top,
 * then per-category mention timelines. Identity color by entity type
 * (validated palette); labels wear text tokens, never series color. */
export default function EpisodeTopics({
  categories,
  duration,
}: {
  categories: Category[];
  duration: number;
}) {
  if (categories.length === 0 || duration <= 0) return null;
  const named = categories.filter((c) => c.name);
  const other = categories.find((c) => !c.name);

  return (
    <div className="section">
      <h2>Topics</h2>

      {named.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 6px" }}>
          {named.map((c) => (
            <span
              key={c.name}
              dir="auto"
              style={{
                fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 700,
                fontSize: 14, border: "1px solid var(--line-2)", borderRadius: 999,
                padding: "6px 14px", color: "var(--ink)",
              }}
            >
              {c.name}
              <span className="mono" style={{ color: "var(--dim)", fontSize: 11, marginInlineStart: 8 }}>
                {c.topics.length}
              </span>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, margin: "10px 0 4px" }}>
        {Object.entries(TYPE_COLORS).map(([label, color]) => (
          <span
            key={label}
            className="mono"
            style={{ fontSize: 11, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <i style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            {label}
          </span>
        ))}
      </div>

      {named.map((c) => (
        <div key={c.name} style={{ marginTop: 18 }}>
          <div
            dir="auto"
            className="mono"
            style={{
              fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--dim)", marginBottom: 8,
            }}
          >
            {c.name}
          </div>
          <TopicRows topics={c.topics} duration={duration} />
        </div>
      ))}
      {other && other.topics.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div
            className="mono"
            style={{
              fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--dim)", marginBottom: 8,
            }}
          >
            more
          </div>
          <TopicRows topics={other.topics} duration={duration} />
        </div>
      )}
      <div
        className="mono"
        style={{ fontSize: 10, color: "var(--dim)", marginTop: 10, display: "flex", justifyContent: "space-between", maxWidth: 900 }}
      >
        <span>0:00</span>
        <span>{ts(duration)}</span>
      </div>
    </div>
  );
}
