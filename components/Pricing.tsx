export default function Pricing() {
  return (
    <section id="pricing" style={{ marginTop: 76 }}>
      <div data-reveal style={{ maxWidth: 640, marginBottom: 26 }}>
        <div className="eyebrow">Pricing</div>
        <h2 className="h2" style={{ marginBottom: 10 }}>
          Priced as a tool, not a toy.
        </h2>
        <p className="lede">
          One sponsored episode covers a year. Merchant of record handles VAT and invoices.
        </p>
      </div>

      <div className="grid g3">
        {/* FREE */}
        <div data-reveal>
          <div
            className="card card-hover"
            style={{
              height: "100%",
              borderRadius: 20,
              padding: "28px 26px",
              display: "flex",
              flexDirection: "column",
              transition: "border-color .3s, transform .3s",
            }}
          >
            <div
              className="mono"
              style={{ fontSize: 12, letterSpacing: 1, color: "var(--dim)", textTransform: "uppercase" }}
            >
              Free
            </div>
            <div
              className="display"
              style={{ fontWeight: 800, fontSize: 38, color: "var(--ink)", margin: "8px 0 16px" }}
            >
              $0
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flex: 1,
              }}
            >
              <li style={{ fontSize: 14, color: "var(--muted)" }}>10h catalog</li>
              <li style={{ fontSize: 14, color: "var(--muted)" }}>Public page only</li>
              <li style={{ fontSize: 14, color: "var(--dim)" }}>“Powered by Backcat” badge</li>
            </ul>
            <a
              href="#start"
              className="btn-ghost"
              style={{ marginTop: 20, textAlign: "center", fontSize: 14, padding: 12 }}
            >
              Start free
            </a>
          </div>
        </div>

        {/* CREATOR */}
        <div data-reveal>
          <div
            style={{
              height: "100%",
              border: "1px solid var(--orange)",
              borderRadius: 20,
              background: "linear-gradient(160deg,#241d16,#16161D)",
              padding: "28px 26px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.4,
                backgroundImage:
                  "radial-gradient(circle,rgba(255,138,61,0.5) 1.2px,transparent 1.6px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div
              className="mono"
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                fontSize: 10.5,
                letterSpacing: 1,
                color: "var(--orange-ink)",
                background: "var(--orange)",
                padding: "3px 9px",
                borderRadius: 999,
              }}
            >
              POPULAR
            </div>
            <div
              className="mono"
              style={{
                position: "relative",
                fontSize: 12,
                letterSpacing: 1,
                color: "var(--orange)",
                textTransform: "uppercase",
              }}
            >
              Creator
            </div>
            <div
              className="display"
              style={{
                position: "relative",
                fontWeight: 800,
                fontSize: 38,
                color: "var(--ink)",
                margin: "8px 0 16px",
              }}
            >
              $29
              <span style={{ fontSize: 16, color: "var(--dim)", fontWeight: 500 }}>/mo</span>
            </div>
            <ul
              style={{
                position: "relative",
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flex: 1,
              }}
            >
              <li style={{ fontSize: 14, color: "var(--ink)" }}>100h catalog · 2k questions/mo</li>
              <li style={{ fontSize: 14, color: "var(--ink)" }}>The Map + dashboard</li>
              <li style={{ fontSize: 14, color: "var(--ink)" }}>Basic branding</li>
            </ul>
            <a
              href="#start"
              className="btn-primary"
              style={{
                position: "relative",
                marginTop: 20,
                textAlign: "center",
                fontSize: 14,
                padding: 12,
              }}
            >
              Choose Creator
            </a>
          </div>
        </div>

        {/* PRO */}
        <div data-reveal>
          <div
            className="card card-hover"
            style={{
              height: "100%",
              borderRadius: 20,
              padding: "28px 26px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="mono"
              style={{ fontSize: 12, letterSpacing: 1, color: "var(--dim)", textTransform: "uppercase" }}
            >
              Pro
            </div>
            <div
              className="display"
              style={{ fontWeight: 800, fontSize: 38, color: "var(--ink)", margin: "8px 0 16px" }}
            >
              $49
              <span style={{ fontSize: 16, color: "var(--dim)", fontWeight: 500 }}>/mo</span>
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flex: 1,
              }}
            >
              <li style={{ fontSize: 14, color: "var(--muted)" }}>300h · 10k q/mo</li>
              <li style={{ fontSize: 14, color: "var(--muted)" }}>Embed widget · weekly digest</li>
              <li style={{ fontSize: 14, color: "var(--muted)" }}>
                Priority ingest · custom domain
              </li>
            </ul>
            <a
              href="#start"
              className="btn-ghost"
              style={{ marginTop: 20, textAlign: "center", fontSize: 14, padding: 12 }}
            >
              Choose Pro
            </a>
          </div>
        </div>
      </div>

      <div data-reveal style={{ marginTop: 14 }}>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 20,
            background: "var(--bg)",
            padding: "20px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span
              className="mono"
              style={{
                fontSize: 12,
                letterSpacing: 1,
                color: "#8A7DF0",
                textTransform: "uppercase",
              }}
            >
              Network · ships later
            </span>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>
              5 shows · agency seats · consolidated billing
            </span>
          </div>
          <span
            className="display"
            style={{ fontWeight: 700, fontSize: 22, color: "var(--ink)" }}
          >
            $199
            <span style={{ fontSize: 14, color: "var(--dim)", fontWeight: 500 }}>/mo</span>
          </span>
        </div>
      </div>
    </section>
  );
}
