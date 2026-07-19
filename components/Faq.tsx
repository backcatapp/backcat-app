const faqs = [
  {
    q: "Wait — can I use this today?",
    a: "Not yet. We're early in the build and the waitlist is the whole product right now. Get on it and you'll be among the first catalogs we map, at founding rates.",
  },
  {
    q: "When does it ship?",
    a: "We're not going to invent a date to look impressive. We're building in public — join the list and you'll hear it from us before anyone else.",
  },
  {
    q: "Will it make things up?",
    a: "That's the line we refuse to cross. Answers will be grounded only in your transcripts, with a citation on every claim — and when it's not in the catalog, it says so instead of guessing.",
  },
  {
    q: "Podcast or YouTube?",
    a: "Both — via RSS or authorized channel connect. Creator-authorized only; no scraping, ever. Tell us which one you're on when you join and it helps us prioritise.",
  },
];

export default function Faq() {
  return (
    <section id="faq" style={{ marginTop: 76 }}>
      <div data-reveal style={{ maxWidth: 640, marginBottom: 26 }}>
        <div className="eyebrow">Questions</div>
        <h2 className="h2" style={{ margin: 0 }}>
          The things you&apos;re about to ask.
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
