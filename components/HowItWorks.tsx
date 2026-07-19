function StepCard({
  num,
  title,
  body,
  art,
}: {
  num: string;
  title: string;
  body: string;
  art: React.ReactNode;
}) {
  return (
    <div data-reveal>
      <div
        className="card card-hover"
        style={{
          height: "100%",
          minHeight: 230,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {art}
        <div
          className="mono"
          style={{ position: "relative", fontSize: 26, color: "var(--line-2)", fontWeight: 500 }}
        >
          {num}
        </div>
        <div style={{ position: "relative" }}>
          <h3
            className="display"
            style={{ fontWeight: 700, fontSize: 18, margin: "0 0 6px", color: "var(--ink)" }}
          >
            {title}
          </h3>
          <p style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--muted)", margin: 0 }}>
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how" style={{ marginTop: 76 }}>
      <div data-reveal style={{ maxWidth: 640, marginBottom: 26 }}>
        <div className="eyebrow">How it&apos;ll work</div>
        <h2 className="h2" style={{ marginBottom: 12 }}>
          Paste a URL. Watch it think. Share the page.
        </h2>
        <p className="lede">
          Four steps, and the whole thing should take less than a coffee. None of it exists yet —
          this is the shape we&apos;re building toward.
        </p>
      </div>

      <div className="grid g4">
        <StepCard
          num="01"
          title="Connect"
          body="Paste an RSS feed or channel. Creator-authorized, no scraping."
          art={
            <div
              aria-hidden="true"
              style={{ position: "absolute", right: -10, top: -10, width: 130, height: 130, opacity: 0.5 }}
            >
              <svg viewBox="0 0 130 130" style={{ width: "100%", height: "100%" }}>
                <g fill="none" stroke="#2C2C36" strokeWidth="1.5">
                  <path d="M10 30 H60 V70 H110" strokeDasharray="4 4" />
                  <path d="M10 90 H40 V50 H120" />
                </g>
                <path
                  d="M10 30 H60 V70 H110"
                  fill="none"
                  stroke="#FF8A3D"
                  strokeWidth="1.5"
                  strokeDasharray="10 230"
                  style={{ animation: "bc-current 2.4s linear infinite" }}
                />
                <circle cx="60" cy="70" r="3" fill="#2FA68C" />
                <circle cx="40" cy="50" r="3" fill="#8A7DF0" />
                <circle cx="120" cy="50" r="3" fill="#2AA9E0" />
              </svg>
            </div>
          }
        />

        <StepCard
          num="02"
          title="Index"
          body="Caption preview in seconds, full quality overnight. It gets smarter while you sleep."
          art={
            <>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.55,
                  backgroundImage: "radial-gradient(circle,#2AA9E0 1.3px,transparent 1.6px)",
                  backgroundSize: "18px 18px",
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "70%",
                  background:
                    "linear-gradient(90deg,transparent,rgba(255,138,61,0.14),transparent)",
                  animation: "bc-sweep 3s ease-in-out infinite",
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg,transparent 40%,rgba(31,31,40,0.85))",
                }}
              />
            </>
          }
        />

        <StepCard
          num="03"
          title="Ask"
          body="Fans ask anything and get cited answers that jump to the exact second."
          art={
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 30,
                height: 80,
                opacity: 0.6,
                overflow: "hidden",
              }}
            >
              <svg
                viewBox="0 0 400 80"
                preserveAspectRatio="none"
                style={{ width: "200%", height: "100%", animation: "bc-wave 8s linear infinite" }}
              >
                <path
                  d="M0 40 C50 15,100 65,150 40 S250 15,300 40 S350 65,400 40"
                  fill="none"
                  stroke="#E8B03E"
                  strokeWidth="2"
                />
                <path
                  d="M0 55 C50 30,100 80,150 55 S250 30,300 55 S350 80,400 55"
                  fill="none"
                  stroke="#FF8A3D"
                  strokeWidth="2"
                />
                <path
                  d="M0 25 C50 0,100 50,150 25 S250 0,300 25 S350 50,400 25"
                  fill="none"
                  stroke="#2FA68C"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          }
        />

        <StepCard
          num="04"
          title="Share & embed"
          body="Live hosted page, or embed the widget on your own domain."
          art={
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                right: -30,
                top: -30,
                width: 150,
                height: 150,
                opacity: 0.5,
                animation: "bc-spin 40s linear infinite",
              }}
            >
              <svg viewBox="0 0 150 150" style={{ width: "100%", height: "100%" }}>
                <g fill="#6E6E78">
                  <circle cx="75" cy="20" r="2" />
                  <circle cx="110" cy="30" r="2" />
                  <circle cx="130" cy="60" r="2" />
                  <circle cx="128" cy="95" r="2" />
                  <circle cx="105" cy="120" r="2" />
                  <circle cx="75" cy="130" r="2" />
                  <circle cx="45" cy="120" r="2" />
                  <circle cx="22" cy="95" r="2" />
                  <circle cx="20" cy="60" r="2" />
                  <circle cx="40" cy="30" r="2" />
                </g>
                <g fill="#FF8A3D">
                  <circle cx="75" cy="45" r="2" />
                  <circle cx="98" cy="55" r="2" />
                  <circle cx="102" cy="80" r="2" />
                  <circle cx="75" cy="95" r="2" />
                  <circle cx="48" cy="80" r="2" />
                  <circle cx="52" cy="55" r="2" />
                </g>
              </svg>
            </div>
          }
        />
      </div>
    </section>
  );
}
