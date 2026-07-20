const links = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Demo" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 6px 40px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/backcat-mark.png"
          alt="backcat"
          style={{ height: 38, width: "auto", display: "block" }}
        />
        <span
          className="display"
          style={{ fontWeight: 700, fontSize: 21, letterSpacing: 0.5, color: "var(--ink)" }}
        >
          backcat
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: 1,
            color: "#E8B03E",
            border: "1px solid rgba(232,176,62,0.35)",
            borderRadius: 999,
            padding: "3px 9px",
            textTransform: "uppercase",
          }}
        >
          Pre-launch
        </span>
      </div>
      <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 26 }}>
        {links.map((l) => (
          <a key={l.href} href={l.href} className="navlink">
            {l.label}
          </a>
        ))}
        <a
          href="#start"
          className="btn-primary"
          style={{ fontSize: 13.5, padding: "10px 18px" }}
        >
          Join the waitlist
        </a>
      </div>
    </nav>
  );
}
