"use client";

import { useActionState } from "react";
import { requestCreditsPublic } from "@/app/actions/waitlist";
import { initialWaitlistState } from "@/lib/waitlist-state";

export default function ExtPricing() {
  const [state, formAction, pending] = useActionState(requestCreditsPublic, initialWaitlistState);

  return (
    <section id="pricing" className="ext-section" data-reveal>
      <h2 className="display ext-section-title">Usage wallet</h2>
      <p className="ext-section-sub">
        Daily free asks, then credits, then your own Anthropic key. No surprise bills.
      </p>
      <div className="ext-tiers">
        <div className="ext-tier">
          <h3>Free daily</h3>
          <p>A capped number of asks every day — enough to try on real videos.</p>
        </div>
        <div className="ext-tier accent">
          <h3>Credits</h3>
          <p>
            Need more? Request credits and we&apos;ll contact you to arrange them —
            no self-serve checkout yet.
          </p>
          <form action={formAction} className="ext-credit-form">
            <input
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              className="waitlist-input"
              aria-label="Email for credit request"
            />
            <input
              name="note"
              placeholder="Optional note"
              className="waitlist-input"
              aria-label="Note"
            />
            <button className="btn-primary" type="submit" disabled={pending}>
              {pending ? "Sending…" : "Request credits — we'll contact you"}
            </button>
            {state.status !== "idle" && (
              <p className={state.status === "error" ? "err" : "ok-msg"}>{state.message}</p>
            )}
          </form>
        </div>
        <div className="ext-tier">
          <h3>BYOK</h3>
          <p>
            Paste your Anthropic key in the extension. Your asks, your spend — Backcat LLM
            cost stays $0.
          </p>
        </div>
      </div>
    </section>
  );
}
