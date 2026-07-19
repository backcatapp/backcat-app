const playerBars = [40, 70, 100, 55, 80, 35, 60, 48];

const mapNodes = [
  { cx: 60, cy: 46, r: 9, fill: "#E0568C", delay: 0 },
  { cx: 130, cy: 36, r: 7, fill: "#E8B03E", delay: 0.5 },
  { cx: 210, cy: 64, r: 11, fill: "#2FA68C", delay: 1 },
  { cx: 96, cy: 110, r: 7, fill: "#8A7DF0", delay: 1.5 },
  { cx: 168, cy: 120, r: 10, fill: "#FF8A3D", delay: 2 },
  { cx: 250, cy: 122, r: 6, fill: "#2AA9E0", delay: 2.5 },
];

const gaps = [
  ["“edge caching setup”", "37×"],
  ["“testing the graph layer”", "24×"],
  ["“solo founder burnout”", "19×"],
];

export default function Showcase() {
  return (
    <section id="demo" style={{ marginTop: 76 }}>
      <div data-reveal style={{ maxWidth: 660, marginBottom: 26 }}>
        <div className="eyebrow">In practice</div>
        <h2 className="h2">See it live on a creator&apos;s catalog.</h2>
        <p className="lede">
          This is Backcat embedded on a dev educator&apos;s own site — 412 episodes turned into
          answers fans can ask, right where their audience already is.{" "}
          <span className="mono" style={{ fontSize: 13, color: "var(--dim)" }}>
            (example)
          </span>
        </p>
      </div>

      <div data-reveal>
        <div className="card card-hover" style={{ background: "#12121A" }}>
          {/* browser chrome */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 18px",
              borderBottom: "1px solid var(--line)",
              background: "var(--bg)",
            }}
          >
            <div style={{ display: "flex", gap: 7 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{ width: 11, height: 11, borderRadius: 999, background: "var(--line-2)" }}
                />
              ))}
            </div>
            <div
              className="mono"
              style={{
                flex: 1,
                maxWidth: 320,
                margin: "0 auto",
                textAlign: "center",
                fontSize: 12,
                color: "var(--dim)",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 999,
                padding: "5px 14px",
              }}
            >
              thecodecafe.dev/ask
            </div>
            <span
              className="mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 11,
                color: "var(--muted)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/backcat-mark-t.png" alt="" style={{ height: 15, width: "auto" }} />
              Powered by Backcat
            </span>
          </div>

          {/* body */}
          <div
            className="showcase-body"
            style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 0 }}
          >
            {/* LEFT */}
            <div
              className="showcase-left"
              style={{ padding: "30px 32px", borderRight: "1px solid var(--line)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                <div
                  className="display"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    background: "linear-gradient(135deg,#2C2C36,#1F1F28)",
                    border: "1px solid var(--line-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 20,
                    color: "var(--muted)",
                    flex: "none",
                  }}
                >
                  DO
                </div>
                <div>
                  <div
                    className="display"
                    style={{ fontWeight: 700, fontSize: 19, color: "var(--ink)" }}
                  >
                    Dana Okafor
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--dim)" }}>
                    @thecodecafe · 412 episodes · 42h indexed
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "6px 6px 6px 16px",
                  marginBottom: 24,
                }}
              >
                <span style={{ flex: 1, fontSize: 15, color: "var(--dim)" }}>
                  Ask Dana anything…
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--orange-ink)",
                    background: "var(--orange)",
                    padding: "9px 18px",
                    borderRadius: 10,
                  }}
                >
                  Ask
                </span>
              </div>

              <div
                style={{
                  display: "inline-block",
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "14px 14px 14px 4px",
                  padding: "9px 14px",
                  fontSize: 14,
                  color: "var(--muted)",
                  marginBottom: 14,
                }}
              >
                Best way to structure a monorepo?
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink)", margin: "0 0 16px" }}>
                “Keep one lockfile, split packages by deploy boundary — not by language — and let the
                CI graph decide what rebuilds. I walked through the exact folder layout on the
                tooling episode…”
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
                {[
                  ["EP 088", "09:12"],
                  ["EP 203", "22:47"],
                ].map(([ep, t]) => (
                  <span key={ep} className="cite" style={{ padding: "6px 12px", fontSize: 12.5 }}>
                    {ep} <span style={{ color: "var(--dim)" }}>·</span>{" "}
                    <span style={{ color: "var(--orange)" }}>{t}</span>
                  </span>
                ))}
              </div>

              {/* mini player */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "12px 16px",
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    background: "var(--orange)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <span
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: "6px solid transparent",
                      borderBottom: "6px solid transparent",
                      borderLeft: "10px solid #4A2508",
                      marginLeft: 2,
                    }}
                  />
                </span>
                <div
                  style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, height: 26 }}
                >
                  {playerBars.map((h, i) => (
                    <span
                      key={i}
                      style={{
                        flex: 1,
                        background: i === 2 ? "var(--orange)" : "var(--line-2)",
                        borderRadius: 2,
                        height: `${h}%`,
                        transformOrigin: "bottom",
                        animation: `bc-eq 1.3s ease-in-out infinite ${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--muted)", flex: "none" }}
                >
                  09:12 <span style={{ color: "var(--dim)" }}>/ 47:33</span>
                </span>
              </div>
            </div>

            {/* RIGHT */}
            <div
              style={{
                padding: "30px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 22,
                background: "radial-gradient(120% 90% at 70% 0%,#191921,#12121A)",
              }}
            >
              <div>
                <div className="label" style={{ letterSpacing: 1, marginBottom: 10 }}>
                  Her concept map
                </div>
                <div style={{ position: "relative", height: 150 }}>
                  <svg
                    viewBox="0 0 300 160"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      animation: "bc-drift 9s ease-in-out infinite",
                    }}
                  >
                    <g stroke="#2C2C36" strokeWidth="1.5" fill="none">
                      <line x1="60" y1="46" x2="130" y2="36" />
                      <line x1="130" y1="36" x2="210" y2="64" />
                      <line x1="60" y1="46" x2="96" y2="110" />
                      <line x1="130" y1="36" x2="168" y2="120" />
                      <line x1="210" y1="64" x2="168" y2="120" />
                      <line x1="210" y1="64" x2="250" y2="122" />
                    </g>
                    {mapNodes.map((n) => (
                      <circle
                        key={`${n.cx}-${n.cy}`}
                        cx={n.cx}
                        cy={n.cy}
                        r={n.r}
                        fill={n.fill}
                        style={{ animation: `bc-pulse 3s ease-in-out infinite ${n.delay}s` }}
                      />
                    ))}
                  </svg>
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--dim)", marginTop: 6 }}>
                  1,942 concepts · 6 clusters
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
                <div className="label" style={{ letterSpacing: 1, marginBottom: 12 }}>
                  Top gaps this week
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {gaps.map(([q, n]) => (
                    <div
                      key={q}
                      className="mono"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12.5,
                        color: "var(--muted)",
                      }}
                    >
                      <span>{q}</span>
                      <span style={{ color: "var(--orange)" }}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
