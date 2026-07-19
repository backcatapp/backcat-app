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
          Map my catalog
        </a>
      </div>
    </nav>
  );
}
