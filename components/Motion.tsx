"use client";

import { useEffect, useRef } from "react";

/**
 * Ports the original landing page's imperative behaviour:
 *  - staggered scroll reveal for every [data-reveal] block
 *  - count-up for [data-count] numbers, fired when their block reveals
 *  - decorative animations stay paused until the pointer enters their card
 */
export default function Motion({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));

    const countUp = (n: HTMLElement) => {
      if (n.dataset.done) return;
      n.dataset.done = "1";
      const target = parseFloat(n.dataset.count || "0");
      const dur = 1200;
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        n.textContent = Math.round(target * e).toLocaleString("en-US");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const reveal = (el: HTMLElement) => {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.dataset.shown = "1";
      el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
    };

    cards.forEach((el, i) => {
      el.style.transition = "opacity .7s ease, transform .7s cubic-bezier(.2,.8,.2,1)";
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 55}ms`;
    });

    const vh = window.innerHeight;
    cards.forEach((el) => {
      if (el.getBoundingClientRect().top >= vh * 0.92) {
        el.style.opacity = "0";
        el.style.transform = "translateY(30px)";
      }
    });

    const runCheck = () => {
      const h = window.innerHeight;
      cards.forEach((el) => {
        if (el.dataset.shown) return;
        if (el.getBoundingClientRect().top < h * 0.9) reveal(el);
      });
    };

    let raf = 0;
    const check = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        runCheck();
      });
    };

    runCheck();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);

    // safety net: never leave a block invisible
    const safety = window.setTimeout(() => cards.forEach(reveal), 1800);

    // animations start on hover
    const teardown: Array<() => void> = [];
    cards.forEach((card) => {
      const anims = Array.from(card.querySelectorAll<HTMLElement>("*")).filter(
        (el) => getComputedStyle(el).animationName !== "none",
      );
      if (!anims.length) return;
      anims.forEach((el) => {
        el.style.animationPlayState = "paused";
      });
      const on = () => anims.forEach((el) => (el.style.animationPlayState = "running"));
      const off = () => anims.forEach((el) => (el.style.animationPlayState = "paused"));
      card.addEventListener("mouseenter", on);
      card.addEventListener("mouseleave", off);
      teardown.push(() => {
        card.removeEventListener("mouseenter", on);
        card.removeEventListener("mouseleave", off);
      });
    });

    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.clearTimeout(safety);
      if (raf) cancelAnimationFrame(raf);
      teardown.forEach((fn) => fn());
    };
  }, []);

  return (
    <div ref={rootRef} style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 0" }}>
      {children}
    </div>
  );
}
