export default function Quote() {
  return (
    <section style={{ marginTop: 24 }}>
      <div data-reveal className="card" style={{ padding: "44px 40px" }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: "100%",
            opacity: 0.25,
            overflow: "hidden",
          }}
        >
          <svg
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
            style={{ width: "200%", height: "100%", animation: "bc-wave 18s linear infinite" }}
          >
            <path
              d="M0 120 C150 60,300 180,450 120 S750 60,900 120 S1050 180,1200 120"
              fill="none"
              stroke="#2C2C36"
              strokeWidth="2"
            />
          </svg>
        </div>
        <p
          className="display"
          style={{
            position: "relative",
            fontWeight: 600,
            fontSize: 26,
            lineHeight: 1.3,
            color: "var(--ink)",
            margin: "0 0 20px",
            maxWidth: 820,
            textWrap: "pretty",
          }}
        >
          “Every creator we talk to has hundreds of hours nobody can search. That&apos;s the bet
          we&apos;re making: the archive isn&apos;t content, it&apos;s an asset nobody could see
          yet. Now we go build the thing that shows it.”
        </p>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/backcat-mark.png" alt="" style={{ height: 26, width: "auto" }} />
          <span className="mono" style={{ fontSize: 12.5, color: "var(--dim)" }}>
            building backcat in public · day 001
          </span>
        </div>
      </div>
    </section>
  );
}
