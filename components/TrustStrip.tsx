const items = [
  "Built creator-authorized",
  "Podcasts + YouTube",
  "Open benchmarks",
  "No number we didn't measure",
];

export default function TrustStrip() {
  return (
    <div data-reveal style={{ marginTop: 22 }}>
      <div
        style={{
          position: "relative",
          border: "1px solid var(--line)",
          borderRadius: 18,
          background: "#141019",
          overflow: "hidden",
        }}
      >
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.4, overflow: "hidden" }}>
          <svg
            viewBox="0 0 1200 90"
            preserveAspectRatio="none"
            style={{ width: "200%", height: "100%", animation: "bc-wave 20s linear infinite" }}
          >
            <path
              d="M0 30 C100 12,200 48,300 30 S500 12,600 30 S800 48,900 30 S1100 12,1200 30"
              fill="none"
              stroke="#2C2C36"
              strokeWidth="1.5"
            />
            <path
              d="M0 55 C100 37,200 73,300 55 S500 37,600 55 S800 73,900 55 S1100 37,1200 55"
              fill="none"
              stroke="#2C2C36"
              strokeWidth="1.5"
            />
            <path
              d="M0 78 C100 60,200 96,300 78 S500 60,600 78 S800 96,900 78 S1100 60,1200 78"
              fill="none"
              stroke="#37373f"
              strokeWidth="1.2"
            />
          </svg>
        </div>
        <div
          className="mono"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: "var(--dim)",
            textTransform: "uppercase",
            letterSpacing: 1,
            padding: "18px 6px",
          }}
        >
          {items.map((t, i) => (
            <span key={t} style={{ display: "contents" }}>
              <span>{t}</span>
              {i < items.length - 1 && <span style={{ color: "var(--line)" }}>/</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
