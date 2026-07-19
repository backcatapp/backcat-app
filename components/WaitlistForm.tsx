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
        flex: "none",
      }}
    >
      {pending ? "Adding…" : "Map my catalog →"}
    </button>
  );
}

export default function WaitlistForm() {
  const [state, formAction] = useActionState(joinWaitlist, initialWaitlistState);

  return (
    <div style={{ maxWidth: 520 }}>
      <form
        action={formAction}
        style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
      >
        {/* honeypot — hidden from people, catnip for bots */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
        />

        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@yourshow.com"
          aria-label="Email address"
          className="waitlist-input"
        />
        <SubmitButton />
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
