"use client";

import WaitlistForm from "./WaitlistForm";

export default function ExtEarlyAccess() {
  return (
    <section id="early" className="ext-section ext-early" data-reveal>
      <h2 className="display ext-section-title">Get the extension early</h2>
      <p className="ext-section-sub">
        Chrome Web Store listing is coming. Leave your email and we&apos;ll send the
        install link when it&apos;s ready.
      </p>
      <div className="ext-early-form" id="start">
        <WaitlistForm />
      </div>
    </section>
  );
}
