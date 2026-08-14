"use client";

type ShotProps = {
  src: string;
  label: string;
  caption?: string;
};

export default function ShotFrame({ src, label, caption }: ShotProps) {
  return (
    <figure className="shot-frame">
      <div className="shot-wrap">
        <div className="shot-fallback">
          <span className="mono">Screenshot slot</span>
          <strong>{label}</strong>
          <span className="mono dim">{src.replace(/^\//, "")}</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="shot-img"
          onLoad={(e) => {
            const img = e.currentTarget;
            img.classList.add("loaded");
            const fb = img.previousElementSibling;
            if (fb instanceof HTMLElement) fb.style.display = "none";
          }}
        />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
