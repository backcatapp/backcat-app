"use client";

import { useState } from "react";

function Paw({ size, fill }: { size: number; fill: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26">
      <ellipse cx="13" cy="17" rx="7" ry="5.5" fill={fill} />
      <circle cx="6" cy="9" r="2.4" fill={fill} />
      <circle cx="12" cy="6.5" r="2.6" fill={fill} />
      <circle cx="18" cy="7.5" r="2.5" fill={fill} />
      <circle cx="22" cy="12" r="2.1" fill={fill} />
    </svg>
  );
}

export default function Hero() {
  const [catHover, setCatHover] = useState(false);

  const paw = (delay: string): React.CSSProperties => ({
    opacity: catHover ? 1 : 0,
    transform: catHover ? "scale(1) translateY(0)" : "scale(0.5) translateY(6px)",
    transition: "opacity .35s ease, transform .35s cubic-bezier(.2,.8,.2,1)",
    transitionDelay: delay,
  });

  return (
    <div className="grid g4">
      {/* HERO */}
      <div data-reveal className="span-3 rowspan-2">
        <div
          className="card card-hover"
          onMouseEnter={() => setCatHover(true)}
          onMouseLeave={() => setCatHover(false)}
          style={{
            height: "100%",
            minHeight: 430,
            background: "linear-gradient(150deg,#1F1F28 0%,#191921 50%,#101017 100%)",
            padding: "46px 42px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* wave-line texture */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 180,
              opacity: 0.35,
              pointerEvents: "none",
            }}
          >
            <svg
              viewBox="0 0 1200 180"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                bottom: 0,
                width: "200%",
                height: "100%",
                animation: "bc-wave 16s linear infinite",
              }}
            >
              <path
                d="M0 110 C 150 55, 300 155, 450 100 S 750 50, 900 110 S 1050 155, 1200 100"
                fill="none"
                stroke="#2C2C36"
                strokeWidth="2"
              />
              <path
                d="M0 135 C 150 85, 300 175, 450 125 S 750 80, 900 135 S 1050 175, 1200 125"
                fill="none"
                stroke="#2C2C36"
                strokeWidth="2"
              />
              <path
                d="M0 85 C 150 35, 300 130, 450 75 S 750 25, 900 85 S 1050 130, 1200 75"
                fill="none"
                stroke="#37373f"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* floating cat mark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/backcat-mark-t.png"
            alt=""
            className="hero-cat"
            style={{
              position: "absolute",
              right: 20,
              bottom: -8,
              width: 320,
              maxWidth: "40%",
              height: "auto",
              filter: "drop-shadow(0 16px 34px rgba(0,0,0,0.55))",
              animation: "bc-float 6.5s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />

          {/* paw trail */}
          <div style={{ position: "absolute", right: "44%", bottom: 120 }}>
            <div style={paw(".02s")}>
              <Paw size={24} fill="#FF8A3D" />
            </div>
          </div>
          <div style={{ position: "absolute", right: "38%", bottom: 74 }}>
            <div style={paw(".1s")}>
              <Paw size={20} fill="#E8B03E" />
            </div>
          </div>
          <div style={{ position: "absolute", right: "31%", bottom: 106 }}>
            <div style={paw(".18s")}>
              <Paw size={18} fill="#2FA68C" />
            </div>
          </div>

          <div className="hero-copy" style={{ position: "relative", maxWidth: "56%" }}>
            <div className="eyebrow" style={{ marginBottom: 22 }}>
              GraphRAG over your catalog
            </div>
            <h1
              className="display"
              style={{
                fontWeight: 800,
                fontSize: 54,
                lineHeight: 1.02,
                letterSpacing: -1,
                margin: "0 0 20px",
                color: "var(--ink)",
                textWrap: "balance",
              }}
            >
              Your back catalog, answering.
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--muted)",
                maxWidth: 430,
                margin: 0,
              }}
            >
              Connect a podcast feed or channel. Every episode becomes one queryable archive — fans
              ask anything and get answers in your own words, cited to the exact second.
            </p>
          </div>

          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 34,
              flexWrap: "wrap",
            }}
          >
            <a href="#start" className="btn-primary" style={{ fontSize: 14, padding: "14px 24px" }}>
              Get started free
            </a>
            <a href="#demo" className="btn-ghost" style={{ fontSize: 15, padding: "14px 22px" }}>
              See it live
            </a>
          </div>
        </div>
      </div>

      {/* LIVE INDEXING */}
      <div data-reveal>
        <div
          className="card card-hover"
          style={{
            height: "100%",
            padding: "24px 22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            className="mono"
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#2FA68C" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "#2FA68C",
                animation: "bc-blink 2.2s infinite",
              }}
            />
            INDEXING · LIVE
          </div>
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 44, margin: "14px 0" }}
          >
            {["#E0568C", "#FF8A3D", "#E8B03E", "#2FA68C", "#2AA9E0", "#8A7DF0"].map((c, i) => (
              <span
                key={c}
                style={{
                  flex: 1,
                  background: c,
                  borderRadius: 3,
                  height: "100%",
                  transformOrigin: "bottom",
                  animation: `bc-eq 1s ease-in-out infinite ${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.4, color: "var(--muted)", margin: 0 }}>
            Every episode transcribed, chunked and graphed — automatically.
          </p>
        </div>
      </div>

      {/* CITATION PILL */}
      <div data-reveal>
        <div
          className="card card-hover"
          style={{
            height: "100%",
            padding: "24px 22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 14,
              bottom: 12,
              display: "flex",
              gap: 7,
              alignItems: "flex-end",
            }}
          >
            {["#E0568C", "#FF8A3D", "#E8B03E", "#2FA68C", "#2AA9E0"].map((c, i) => (
              <span
                key={c}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: c,
                  animation: `bc-pxwave 1.6s ease-in-out infinite ${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <div
            className="mono"
            style={{ position: "relative", fontSize: 11.5, letterSpacing: 1, color: "var(--dim)" }}
          >
            CITED TO THE SECOND
          </div>
          <div style={{ position: "relative", margin: "8px 0" }}>
            <span className="cite cite-hover" style={{ padding: "7px 13px", fontSize: 13 }}>
              EP 112 <span style={{ color: "var(--dim)" }}>·</span>{" "}
              <span style={{ color: "var(--orange)" }}>14:32</span>
            </span>
          </div>
          <p
            style={{
              position: "relative",
              fontSize: 13,
              lineHeight: 1.4,
              color: "var(--muted)",
              margin: 0,
            }}
          >
            Click any answer, the player pounces straight to the moment.
          </p>
        </div>
      </div>
    </div>
  );
}
