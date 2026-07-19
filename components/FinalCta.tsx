import WaitlistForm from "@/components/WaitlistForm";

const bars = [
  { h: "60%", c: "#E0568C", d: 0 },
  { h: "80%", c: "#FF8A3D", d: 0.15 },
  { h: "100%", c: "#E8B03E", d: 0.3 },
  { h: "75%", c: "#2FA68C", d: 0.45 },
  { h: "55%", c: "#2AA9E0", d: 0.6 },
];

export default function FinalCta() {
  return (
    <section id="start" style={{ marginTop: 24 }}>
      <div
        data-reveal
        style={{
          position: "relative",
          border: "1px solid var(--line)",
          borderRadius: 22,
          background: "radial-gradient(120% 160% at 80% 0%,#20202a,#16161D)",
          padding: "48px 40px",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 26,
            bottom: 0,
            width: 220,
            height: 120,
            opacity: 0.9,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {bars.map((b) => (
            <span
              key={b.c}
              style={{
                width: 8,
                height: b.h,
                borderRadius: 4,
                background: b.c,
                transformOrigin: "bottom",
                animation: `bc-eq 1.2s ease-in-out infinite ${b.d}s`,
              }}
            />
          ))}
        </div>
        <div style={{ position: "relative", maxWidth: 620 }}>
          <h2
            className="display"
            style={{
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.04,
              letterSpacing: -1,
              margin: "0 0 12px",
              color: "var(--ink)",
            }}
          >
            Be there when the cat wakes up.
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.5, color: "var(--muted)", margin: "0 0 28px" }}>
            We&apos;re building this now, in public, from day one. Leave your details and
            we&apos;ll map your catalog before we open it to anyone else. The cat was consulted
            and had no notes.
          </p>
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
