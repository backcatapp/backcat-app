const stats = [
  { value: "0", count: true, label: "episodes indexed", note: "yours could be the first" },
  { value: "1", count: true, label: "cat consulted", note: "he had no notes" },
  { value: "001", count: false, label: "day, building in public", note: "follow along" },
];

export default function Numbers() {
  return (
    <section style={{ marginTop: 76 }}>
      <div
        data-reveal
        style={{
          position: "relative",
          border: "1px solid var(--line)",
          borderRadius: 22,
          background: "#12121A",
          padding: "38px 34px",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -40,
            opacity: 0.5,
            background: "linear-gradient(115deg,#E0568C,#8A7DF0,#2AA9E0,#2FA68C,#E8B03E,#FF8A3D)",
            backgroundSize: "280% 280%",
            filter: "blur(60px)",
            animation: "bc-hue 14s ease-in-out infinite, bc-noise 7s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            backgroundImage: "radial-gradient(circle,#000 1px,transparent 1.4px)",
            backgroundSize: "5px 5px",
            mixBlendMode: "overlay",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg,rgba(18,18,26,0.55),rgba(18,18,26,0.82))",
          }}
        />
        <div
          className="mono"
          style={{
            position: "relative",
            fontSize: 12,
            letterSpacing: 1.5,
            color: "var(--muted)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Nothing measured yet
        </div>
        <p
          style={{
            position: "relative",
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--dim)",
            margin: "0 0 26px",
            maxWidth: 520,
          }}
        >
          We said we&apos;d never show a number we hadn&apos;t measured. So here&apos;s the honest
          scoreboard on day one.
        </p>
        <div
          className="numbers-grid"
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 24,
          }}
        >
          {stats.map((s) => (
            <div key={s.label}>
              <div
                className="display"
                style={{
                  fontWeight: 800,
                  fontSize: 46,
                  lineHeight: 1,
                  color: "var(--ink)",
                  letterSpacing: -2,
                }}
              >
                {s.count ? <span data-count={s.value}>0</span> : s.value}
              </div>
              <p style={{ fontSize: 14, color: "var(--muted)", margin: "10px 0 0" }}>{s.label}</p>
              <p className="mono" style={{ fontSize: 11.5, color: "var(--dim)", margin: "4px 0 0" }}>
                {s.note}
              </p>
            </div>
          ))}
          <div>
            <div
              className="display"
              style={{
                fontWeight: 800,
                fontSize: 46,
                lineHeight: 1,
                color: "var(--orange)",
                letterSpacing: -2,
              }}
            >
              &lt;1s
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "10px 0 0" }}>
              to the cited second
            </p>
            <p className="mono" style={{ fontSize: 11.5, color: "var(--dim)", margin: "4px 0 0" }}>
              the bar we&apos;re building to
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
