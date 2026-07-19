const pxGrid = [
  ["#E0568C", 0],
  ["#FF8A3D", 0.15],
  ["#E8B03E", 0.3],
  ["#2FA68C", 0.45],
  ["#FF8A3D", 0.3],
  ["#E8B03E", 0.45],
  ["#2FA68C", 0.6],
  ["#2AA9E0", 0.75],
  ["#E8B03E", 0.45],
  ["#2FA68C", 0.6],
  ["#2AA9E0", 0.75],
  ["#8A7DF0", 0.9],
] as const;

export default function MoreFeatures() {
  return (
    <section style={{ marginTop: 76 }}>
      <div data-reveal style={{ maxWidth: 640, marginBottom: 26 }}>
        <div className="eyebrow">Yours to own</div>
        <h2 className="h2" style={{ margin: 0 }}>
          Built for creators, not platforms.
        </h2>
      </div>

      <div className="grid g4">
        {/* OWNERSHIP */}
        <div id="own" data-reveal className="span-2">
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 210,
              padding: "28px 26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              aria-hidden="true"
              style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "55%", opacity: 0.6 }}
            >
              <svg
                viewBox="0 0 300 210"
                preserveAspectRatio="xMidYMid slice"
                style={{ width: "100%", height: "100%" }}
              >
                <g fill="none" stroke="#2C2C36" strokeWidth="1.5">
                  <path d="M40 40 H140 V100 H240 V60 H300" />
                  <path d="M40 170 H90 V120 H190 V160 H300" />
                  <path d="M140 100 V150 H90" />
                </g>
                <path
                  d="M40 40 H140 V100 H240 V60 H300"
                  fill="none"
                  stroke="#FF8A3D"
                  strokeWidth="1.5"
                  strokeDasharray="14 320"
                  style={{ animation: "bc-current 3s linear infinite" }}
                />
                <circle cx="140" cy="100" r="3.5" fill="#2FA68C" />
                <circle cx="240" cy="60" r="3.5" fill="#8A7DF0" />
                <circle cx="90" cy="120" r="3.5" fill="#2AA9E0" />
                <circle cx="190" cy="160" r="3.5" fill="#E0568C" />
              </svg>
            </div>
            <div style={{ position: "relative", maxWidth: "56%" }}>
              <h3
                className="display"
                style={{ fontWeight: 700, fontSize: 22, margin: "0 0 8px", color: "var(--ink)" }}
              >
                Embed on your domain. Export everything.
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)", margin: 0 }}>
                No destination owns your fans. The knowledge layer lives on your site, and your data
                leaves with you.
              </p>
            </div>
            <div
              style={{
                position: "relative",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 16,
              }}
            >
              <span className="cite" style={{ padding: "7px 12px", fontSize: 12, gap: 7 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/backcat-mark.png" alt="" style={{ height: 15, width: "auto" }} />
                Powered by Backcat
              </span>
              <span className="cite" style={{ padding: "7px 12px", fontSize: 12 }}>
                &lt;script&gt; embed
              </span>
              <span className="cite" style={{ padding: "7px 12px", fontSize: 12 }}>
                export ↓
              </span>
            </div>
          </div>
        </div>

        {/* CITED */}
        <div data-reveal>
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 210,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              className="mono"
              style={{ fontWeight: 500, fontSize: 30, color: "var(--orange)", letterSpacing: -1 }}
            >
              14:32
            </div>
            <div
              style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 34, margin: "8px 0" }}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 4,
                    borderRadius: 2,
                    background: i === 2 ? "var(--orange)" : "var(--line-2)",
                    height: "100%",
                    transformOrigin: "bottom",
                    animation: `bc-eq 1.4s ease-in-out infinite ${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <div>
              <h3
                className="display"
                style={{ fontWeight: 700, fontSize: 17, margin: "0 0 4px", color: "var(--ink)" }}
              >
                Second-level citations
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.4, color: "var(--muted)", margin: 0 }}>
                Every claim carries a timestamp with an address.
              </p>
            </div>
          </div>
        </div>

        {/* WEEKLY DIGEST */}
        <div data-reveal>
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 210,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 16,
                height: 70,
                opacity: 0.5,
                overflow: "hidden",
              }}
            >
              <svg
                viewBox="0 0 400 70"
                preserveAspectRatio="none"
                style={{ width: "200%", height: "100%", animation: "bc-wave 11s linear infinite" }}
              >
                <path
                  d="M0 35 C50 12,100 58,150 35 S250 12,300 35 S350 58,400 35"
                  fill="none"
                  stroke="#2C2C36"
                  strokeWidth="2"
                />
                <path
                  d="M0 48 C50 25,100 71,150 48 S250 25,300 48 S350 71,400 48"
                  fill="none"
                  stroke="#37373f"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <div className="mono" style={{ fontSize: 11.5, letterSpacing: 1, color: "var(--dim)" }}>
              EVERY MONDAY
            </div>
            <div style={{ position: "relative" }}>
              <h3
                className="display"
                style={{ fontWeight: 700, fontSize: 17, margin: "0 0 4px", color: "var(--ink)" }}
              >
                Weekly digest
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.4, color: "var(--muted)", margin: 0 }}>
                What fans asked, what&apos;s trending, what to make next.
              </p>
            </div>
          </div>
        </div>

        {/* HONEST ABOUT THE DARK */}
        <div data-reveal>
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 210,
              background: "#141019",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(60% 60% at 50% 45%, rgba(110,110,120,0.14), transparent 70%)",
                animation: "bc-pulse 4s ease-in-out infinite",
              }}
            />
            <div
              className="mono"
              style={{
                position: "relative",
                fontSize: 11.5,
                letterSpacing: 1,
                color: "var(--dim)",
                marginBottom: 10,
              }}
            >
              // honest about the dark
            </div>
            <p
              className="display"
              style={{
                position: "relative",
                fontWeight: 600,
                fontSize: 18,
                lineHeight: 1.25,
                color: "var(--ink)",
                margin: "0 0 6px",
              }}
            >
              “Not covered yet. Logged.”
            </p>
            <p
              style={{
                position: "relative",
                fontSize: 13,
                lineHeight: 1.4,
                color: "var(--muted)",
                margin: 0,
              }}
            >
              A miss is how the next episode gets made.
            </p>
          </div>
        </div>

        {/* BENCHMARKS */}
        <div data-reveal>
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 210,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 14,
                top: 14,
                display: "grid",
                gridTemplateColumns: "repeat(4,6px)",
                gap: 5,
                opacity: 0.7,
              }}
            >
              {pxGrid.map(([c, d], i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 1,
                    background: c,
                    animation: `bc-pxwave 1.8s ease-in-out infinite ${d}s`,
                  }}
                />
              ))}
            </div>
            <div
              className="mono"
              style={{ position: "relative", fontSize: 11.5, letterSpacing: 1, color: "var(--dim)" }}
            >
              FAITHFULNESS EVAL
            </div>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                height: 70,
              }}
            >
              {[
                { h: "52%", bg: "#2C2C36", d: 0 },
                { h: "68%", bg: "#2C2C36", d: 0.3 },
                { h: "100%", bg: "linear-gradient(#FFA766,#FF8A3D)", d: 0.6 },
              ].map((b, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: b.h,
                    background: b.bg,
                    borderRadius: 4,
                    transformOrigin: "bottom",
                    animation: `bc-eq 3s ease-in-out infinite ${b.d}s`,
                  }}
                />
              ))}
            </div>
            <div style={{ position: "relative" }}>
              <h3
                className="display"
                style={{ fontWeight: 700, fontSize: 17, margin: "0 0 4px", color: "var(--ink)" }}
              >
                Open benchmarks
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.4, color: "var(--muted)", margin: 0 }}>
                Grounded-only guardrail, evaluated every release.
              </p>
            </div>
          </div>
        </div>

        {/* NETWORK */}
        <div data-reveal>
          <div
            className="card card-hover"
            style={{
              height: "100%",
              minHeight: 210,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              aria-hidden="true"
              style={{ position: "absolute", right: 8, top: 12, width: 120, height: 120 }}
            >
              {[
                { l: 10, t: 20, s: 60, bg: "#2FA68C", dur: 7, d: 0 },
                { l: 45, t: 10, s: 56, bg: "#8A7DF0", dur: 8, d: 0.5 },
                { l: 35, t: 45, s: 52, bg: "#E0568C", dur: 9, d: 1 },
              ].map((c, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: c.l,
                    top: c.t,
                    width: c.s,
                    height: c.s,
                    borderRadius: 999,
                    background: c.bg,
                    mixBlendMode: "screen",
                    opacity: 0.55,
                    animation: `bc-orbit ${c.dur}s ease-in-out infinite ${c.d}s`,
                  }}
                />
              ))}
            </div>
            <div
              className="mono"
              style={{ position: "relative", fontSize: 11.5, letterSpacing: 1, color: "var(--dim)" }}
            >
              NETWORK · SOON
            </div>
            <div style={{ position: "relative" }}>
              <h3
                className="display"
                style={{ fontWeight: 700, fontSize: 17, margin: "0 0 4px", color: "var(--ink)" }}
              >
                Multi-show &amp; teams
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.4, color: "var(--muted)", margin: 0 }}>
                Up to 5 catalogs, agency seats, consolidated billing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
