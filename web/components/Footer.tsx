// Anything without a real destination is rendered as dimmed "soon" text rather
// than a link that goes nowhere.
const columns = [
  {
    title: "Product",
    links: [
      { href: "#how", label: "How it works" },
      { href: "#pricing", label: "Pricing" },
      { href: "#early", label: "Early access" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: null, label: "Build log" },
      { href: null, label: "Benchmarks" },
      { href: null, label: "Docs" },
    ],
  },
  {
    title: "Follow",
    links: [
      { href: null, label: "X / @backcat" },
      { href: null, label: "YouTube" },
      { href: null, label: "GitHub" },
    ],
  },
];

const swatches = ["#E0568C", "#FF8A3D", "#E8B03E", "#2FA68C", "#2AA9E0", "#8A7DF0"];

export default function Footer() {
  return (
    <footer style={{ marginTop: 56, padding: "36px 6px", borderTop: "1px solid var(--line)" }}>
      <div
        className="footer-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 24,
          marginBottom: 32,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/backcat-mark.png" alt="" style={{ height: 28, width: "auto" }} />
            <span
              className="display"
              style={{ fontWeight: 700, fontSize: 18, color: "var(--ink)" }}
            >
              backcat
            </span>
          </div>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--dim)",
              margin: 0,
              maxWidth: 260,
            }}
          >
            Your back catalog, answering. Cited answers, a living map, and a plan — from the work
            you already made. In build, in public, starting now.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                letterSpacing: 1,
                color: "var(--dim)",
                textTransform: "uppercase",
              }}
            >
              {col.title}
            </span>
            {col.links.map((l) =>
              l.href ? (
                <a key={l.label} href={l.href} className="footlink">
                  {l.label}
                </a>
              ) : (
                <span
                  key={l.label}
                  style={{
                    fontSize: 14,
                    color: "var(--dim)",
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 7,
                  }}
                >
                  {l.label}
                  <span className="mono" style={{ fontSize: 10.5, letterSpacing: 0.5 }}>
                    soon
                  </span>
                </span>
              ),
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          paddingTop: 20,
          borderTop: "1px solid var(--line)",
        }}
      >
        <span className="mono" style={{ fontSize: 12, color: "var(--dim)" }}>
          © 2026 backcat — the cat was consulted and had no notes.
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {swatches.map((c) => (
            <span key={c} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
          ))}
        </div>
      </div>
    </footer>
  );
}
