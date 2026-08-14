const faqs = [
  {
    q: "Is it a Chrome extension?",
    a: "Yes — that's the product. Side panel + a Backcat button on YouTube watch pages. The website is landing + admin.",
  },
  {
    q: "Where do answers come from?",
    a: "Only from the creator's indexed catalog (Whisper transcripts → chunks). Citations deep-link to [episode, mm:ss].",
  },
  {
    q: "How do I buy more credits?",
    a: "Request credits in the extension Profile or on this page. We'll contact you — there's no self-serve checkout yet.",
  },
  {
    q: "Can I use my own API key?",
    a: "Yes. BYOK Anthropic in Profile. When free + credits are gone, asks use your key.",
  },
];

export default function ExtFaq() {
  return (
    <section id="faq" className="ext-section" data-reveal>
      <h2 className="display ext-section-title">FAQ</h2>
      <div className="ext-faq">
        {faqs.map((f) => (
          <details key={f.q} className="ext-faq-item">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
