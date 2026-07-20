"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { joinWaitlist } from "@/app/actions/waitlist";
import { initialWaitlistState } from "@/lib/waitlist-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-primary"
      disabled={pending}
      style={{
        fontSize: 15,
        padding: "14px 26px",
        border: "none",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.75 : 1,
      }}
    >
      {pending ? "Adding…" : "Map my catalog →"}
    </button>
  );
}

function Optional() {
  return (
    <span className="mono" style={{ color: "var(--dim)", fontSize: 11, letterSpacing: 0.5 }}>
      {" "}
      · optional
    </span>
  );
}

export default function WaitlistForm() {
  const [state, formAction] = useActionState(joinWaitlist, initialWaitlistState);

  return (
    <div style={{ maxWidth: 520 }}>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* honeypot — hidden from people, catnip for bots */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
        />

        <div className="field">
          <label className="field-label" htmlFor="wl-email">
            Email
          </label>
          <input
            id="wl-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@yourshow.com"
            className="waitlist-input"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="wl-feed">
            Your podcast or YouTube
            <Optional />
          </label>
          <input
            id="wl-feed"
            type="text"
            name="feed_url"
            inputMode="url"
            autoComplete="url"
            placeholder="youtube.com/@yourshow or your RSS feed"
            className="waitlist-input"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="wl-question">
            A question your audience keeps asking
            <Optional />
          </label>
          <textarea
            id="wl-question"
            name="sample_question"
            rows={2}
            maxLength={500}
            placeholder="“How do you handle cold-start?”"
            className="waitlist-input waitlist-textarea"
          />
          <p className="field-hint">
            We&apos;ll check your catalog for the answer — and show you where the gap is if there
            isn&apos;t one.
          </p>
        </div>

        <div>
          <SubmitButton />
        </div>
      </form>

      <p
        role="status"
        aria-live="polite"
        className="mono"
        style={{
          minHeight: 18,
          margin: "14px 0 0",
          fontSize: 12.5,
          letterSpacing: 0.2,
          color:
            state.status === "error"
              ? "#E0568C"
              : state.status === "success"
                ? "#2FA68C"
                : "var(--dim)",
        }}
      >
        {state.message}
      </p>
    </div>
  );
}
