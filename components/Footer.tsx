const columns = [
  {
    title: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
      { href: "#how", label: "How it works" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "#", label: "Build log" },
      { href: "#", label: "Benchmarks" },
      { href: "#", label: "Docs" },
    ],
  },
  {
    title: "Follow",
    links: [
      { href: "#", label: "X / @backcat" },
      { href: "#", label: "YouTube" },
      { href: "#", label: "GitHub" },
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
            Your back catalog, answering. Cited answers, a living map, and a plan — from the work you
            already made.
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
            {col.links.map((l) => (
              <a key={l.label} href={l.href} className="footlink">
                {l.label}
              </a>
            ))}
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
