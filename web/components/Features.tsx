const graphNodes = [
  { cx: 70, cy: 60, r: 10, fill: "#E0568C", delay: 0 },
  { cx: 140, cy: 46, r: 7, fill: "#E8B03E", delay: 0.4 },
  { cx: 222, cy: 80, r: 12, fill: "#2FA68C", delay: 0.8 },
  { cx: 106, cy: 140, r: 8, fill: "#8A7DF0", delay: 1.2 },
  { cx: 180, cy: 156, r: 11, fill: "#FF8A3D", delay: 1.6 },
  { cx: 262, cy: 160, r: 6, fill: "#2AA9E0", delay: 2 },
];

export default function Features() {
  return (
    <section id="features" style={{ marginTop: 72 }}>
      <div data-reveal style={{ maxWidth: 640, marginBottom: 26 }}>
        <div className="eyebrow">Three owned assets</div>
        <h2 className="h2">One catalog. Three things you&apos;ll own.</h2>
        <p className="lede">
          Not a chatbot toy. We&apos;re building a content-intelligence layer that turns hundreds
          of hours nobody can search into cited answers, a living map, and a plan.
        </p>
      </div>

      <div className="grid g3">
        {/* ASK ANYTHING */}
        <div data-reveal className="rowspan-2">
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 330,
              padding: "28px 26px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.5,
                backgroundImage: "radial-gradient(circle, #2FA68C 1.4px, transparent 1.8px)",
                backgroundSize: "26px 26px",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(31,31,40,0.9) 55%)",
              }}
            />
            <div style={{ position: "relative", flex: 1 }}>
              <div className="label" style={{ marginBottom: 18 }}>
                Cited Q&amp;A
              </div>
              <div
                style={{
                  display: "inline-block",
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: "14px 14px 14px 4px",
                  padding: "10px 14px",
                  fontSize: 13.5,
                  color: "var(--muted)",
                  marginBottom: 14,
                }}
              >
                How do you handle cold-start?
              </div>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: "var(--ink)",
                  margin: "0 0 16px",
                }}
              >
                “Start with a hand-picked seed set, log every query, and let real demand tell you
                what to build next…”
              </p>
              <span className="cite" style={{ padding: "6px 12px", fontSize: 12.5 }}>
                EP 112 <span style={{ color: "var(--dim)" }}>·</span>{" "}
                <span style={{ color: "var(--orange)" }}>14:32</span>
              </span>
            </div>
            <div
              style={{
                position: "relative",
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid var(--line)",
              }}
            >
              <h3
                className="display"
                style={{ fontWeight: 700, fontSize: 19, margin: "0 0 6px", color: "var(--ink)" }}
              >
                Answers, in her own words
              </h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--muted)", margin: 0 }}>
                Grounded only in what you actually said. No hallucinated takes.
              </p>
            </div>
          </div>
        </div>

        {/* THE MAP */}
        <div id="map" data-reveal className="rowspan-2">
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 330,
              background: "radial-gradient(120% 100% at 70% 15%,#20202a 0%,#16161D 70%)",
              padding: "28px 26px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="label" style={{ marginBottom: 10 }}>
              The Map
            </div>
            <h3
              className="display"
              style={{
                fontWeight: 700,
                fontSize: 21,
                lineHeight: 1.12,
                letterSpacing: -0.3,
                margin: "0 0 4px",
                color: "var(--ink)",
              }}
            >
              Every concept you&apos;ve covered
            </h3>
            <div style={{ flex: 1, position: "relative", margin: "8px -6px", minHeight: 170 }}>
              <svg
                viewBox="0 0 320 240"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  animation: "bc-drift 9s ease-in-out infinite",
                }}
              >
                <g stroke="#2C2C36" strokeWidth="1.5" fill="none">
                  <line x1="70" y1="60" x2="140" y2="46" />
                  <line x1="140" y1="46" x2="222" y2="80" />
                  <line x1="70" y1="60" x2="106" y2="140" />
                  <line x1="140" y1="46" x2="180" y2="156" />
                  <line x1="222" y1="80" x2="180" y2="156" />
                  <line x1="222" y1="80" x2="262" y2="160" />
                  <line x1="106" y1="140" x2="180" y2="156" />
                  <line x1="180" y1="156" x2="146" y2="206" />
                </g>
                {graphNodes.map((n) => (
                  <circle
                    key={`${n.cx}-${n.cy}`}
                    cx={n.cx}
                    cy={n.cy}
                    r={n.r}
                    fill={n.fill}
                    style={{ animation: `bc-pulse 3s ease-in-out infinite ${n.delay}s` }}
                  />
                ))}
                <circle
                  cx="146"
                  cy="206"
                  r="10"
                  fill="none"
                  stroke="#6E6E78"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  style={{ animation: "bc-pulse 3s ease-in-out infinite" }}
                />
              </svg>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--muted)", margin: 0 }}>
              An interactive knowledge graph of your whole catalog — every idea and how it connects.
            </p>
          </div>
        </div>

        {/* THE GAP REPORT */}
        <div data-reveal className="rowspan-2">
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 330,
              padding: "28px 26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div className="label" style={{ marginBottom: 10 }}>
                The Gap Report · sample
              </div>
              <h3
                className="display"
                style={{
                  fontWeight: 700,
                  fontSize: 21,
                  lineHeight: 1.12,
                  letterSpacing: -0.3,
                  margin: "0 0 8px",
                  color: "var(--ink)",
                }}
              >
                A content plan from the silence
              </h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--muted)", margin: 0 }}>
                The questions fans keep asking that you haven&apos;t answered — yet. Absence is
                intelligence here.
              </p>
            </div>
            <div
              aria-hidden="true"
              style={{
                position: "relative",
                height: 150,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    border: "1.5px solid #6E6E78",
                    animation: `bc-ripple 3s ease-out infinite ${i}s`,
                  }}
                />
              ))}
              <div
                style={{
                  position: "relative",
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "var(--orange)",
                  boxShadow: "0 0 16px #FF8A3D",
                }}
              />
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {[
                ["“self-hosting the DB”", "asked 41×"],
                ["“pricing for agencies”", "asked 28×"],
              ].map(([q, n]) => (
                <li
                  key={q}
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{q}</span>
                  <span style={{ color: "var(--orange)" }}>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
