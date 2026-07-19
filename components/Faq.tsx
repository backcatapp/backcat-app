const faqs = [
  {
    q: "Does it make things up?",
    a: "No. Answers are grounded only in your transcripts, with a citation on every claim. If it's not in the catalog, it says so.",
  },
  {
    q: "Podcast or YouTube?",
    a: "Both — via RSS or authorized channel connect. Creator-authorized only; no scraping in the paid path.",
  },
  {
    q: "Do I own the data?",
    a: "Yes. Embed it on your own domain and export everything — transcripts, graph, and question logs — anytime.",
  },
  {
    q: "How long to go live?",
    a: "Under 30 minutes of touch-time. A caption preview makes the first minutes feel instant; full quality lands overnight.",
  },
];

export default function Faq() {
  return (
    <section id="faq" style={{ marginTop: 76 }}>
      <div data-reveal style={{ maxWidth: 640, marginBottom: 26 }}>
        <div className="eyebrow">Questions</div>
        <h2 className="h2" style={{ margin: 0 }}>
          The things fans ask us.
        </h2>
      </div>
      <div className="grid g2" style={{ gridAutoRows: "auto" }}>
        {faqs.map((f) => (
          <div key={f.q} data-reveal>
            <div
              className="border-hover"
              style={{
                border: "1px solid var(--line)",
                borderRadius: 18,
                background: "var(--card)",
                padding: "24px 26px",
                height: "100%",
              }}
            >
              <h3
                className="display"
                style={{ fontWeight: 700, fontSize: 17, margin: "0 0 8px", color: "var(--ink)" }}
              >
                {f.q}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)", margin: 0 }}>
                {f.a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
