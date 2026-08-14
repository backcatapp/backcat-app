import ShotFrame from "./ShotFrame";

export default function ExtHow() {
  const steps = [
    {
      n: "01",
      title: "Open a video",
      body: "On YouTube, Backcat sits next to Share — one click.",
    },
    {
      n: "02",
      title: "Ask in the side panel",
      body: "Questions about this creator’s catalog, not the open web.",
    },
    {
      n: "03",
      title: "Jump to [mm:ss]",
      body: "Every claim cites a moment. Click to seek the player.",
    },
  ];

  return (
    <section id="how" className="ext-section" data-reveal>
      <h2 className="display ext-section-title">How it works on YouTube</h2>
      <p className="ext-section-sub">Three steps. The timestamp is the product.</p>
      <div className="ext-steps">
        {steps.map((s) => (
          <div key={s.n} className="ext-step">
            <span className="mono ext-step-n">{s.n}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
      <div className="ext-gallery" id="demo">
        <ShotFrame
          src="/landing/shot-ask.png"
          label="Ask + citations"
          caption="Cited answers in the side panel"
        />
        <ShotFrame
          src="/landing/shot-graph.png"
          label="Concept map"
          caption="Concepts from this video"
        />
        <ShotFrame
          src="/landing/shot-channels.png"
          label="Channels"
          caption="Save, index, ask across a catalog"
        />
      </div>
    </section>
  );
}
