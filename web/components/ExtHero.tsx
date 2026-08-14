import ShotFrame from "./ShotFrame";

export default function ExtHero() {
  const store = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "#install";

  return (
    <section className="ext-hero" data-reveal>
      <div className="ext-hero-copy">
        <p className="ext-kicker mono">Chrome extension</p>
        <h1 className="display ext-brand">
          back<span>cat</span>
        </h1>
        <p className="ext-headline">
          Ask any YouTube creator&apos;s catalog — answers cited to the exact second.
        </p>
        <p className="ext-sub">
          Side panel on YouTube. Grounded in their words. Jump straight to the moment.
        </p>
        <div className="ext-cta-row">
          <a className="btn-primary" href={store} id="install">
            Add to Chrome
          </a>
          <a className="btn-ghost-landing" href="#early">
            Get early access
          </a>
        </div>
      </div>
      <div className="ext-hero-visual" aria-label="Product preview">
        <div className="ext-browser">
          <div className="ext-browser-bar">
            <i /><i /><i />
            <div className="ext-url mono">youtube.com/watch</div>
          </div>
          <div className="ext-browser-body">
            <ShotFrame src="/landing/hero-sidepanel.png" label="Ask side panel" />
          </div>
        </div>
      </div>
    </section>
  );
}
