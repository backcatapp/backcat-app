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
            marginBottom: 26,
          }}
        >
          One catalog, measured
        </div>
        <div
          className="numbers-grid"
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 24,
          }}
        >
          {[
            { count: "412", suffix: null, label: "episodes indexed" },
            { count: "1942", suffix: null, label: "concepts mapped" },
            { count: "42", suffix: "h", label: "of audio, queryable" },
          ].map((n) => (
            <div key={n.label}>
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
                <span data-count={n.count}>0</span>
                {n.suffix && <span style={{ fontSize: 24, color: "var(--dim)" }}>{n.suffix}</span>}
              </div>
              <p style={{ fontSize: 14, color: "var(--muted)", margin: "10px 0 0" }}>{n.label}</p>
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
          </div>
        </div>
      </div>
    </section>
  );
}
