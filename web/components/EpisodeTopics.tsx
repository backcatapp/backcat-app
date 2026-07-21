import { TYPE_COLORS } from "./ConceptGraph";

type Topic = {
  name: string;
  label: string;
  mentions: number;
  windows: { start_s: number; end_s: number }[];
};

function ts(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Per-episode topic timeline: rows = topics (top by mentions), marks =
 * mention windows across the episode. Identity color by entity type (validated
 * palette); labels wear text tokens, never the series color. */
export default function EpisodeTopics({
  topics,
  duration,
}: {
  topics: Topic[];
  duration: number;
}) {
  const rows = topics.slice(0, 12);
  if (rows.length === 0 || duration <= 0) return null;
  const W = 640;
  const ROW = 26;
  const H = rows.length * ROW;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * duration);

  return (
    <div className="section">
      <h2>
        Topics <span className="mono" style={{ color: "var(--dim)", fontSize: 12 }}>({topics.length})</span>
      </h2>
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 0, maxWidth: 900 }}>
        <div>
          {rows.map((t) => (
            <div
              key={t.name}
              dir="auto"
              title={`${t.name} — ${t.mentions} mentions`}
              style={{
                height: ROW,
                display: "flex",
                alignItems: "center",
                fontSize: 12.5,
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingInlineEnd: 12,
              }}
            >
              {t.name}
            </div>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${W} ${H + 22}`}
            width="100%"
            style={{ display: "block", minWidth: 420 }}
            role="img"
            aria-label="Topic mentions across the episode"
          >
            {ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={(t / duration) * W}
                  x2={(t / duration) * W}
                  y1={0}
                  y2={H}
                  stroke="var(--line)"
                  strokeWidth={1}
                />
                <text
                  x={(t / duration) * W}
                  y={H + 16}
                  fontSize={10}
                  fill="var(--dim)"
                  textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
                  fontFamily="var(--font-mono), monospace"
                >
                  {ts(t)}
                </text>
              </g>
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
    </div>
  );
}
