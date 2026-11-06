"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Feeds the band's scroll progress to CSS as --p: 0 when it enters at the bottom, 1 once it is centred.
 * All the motion lives in globals.css (.promo-*). Without JS or with reduced motion --p stays 1: the finished poster.
 */
export function PromoScroll({ className, labelledBy, children }: { className?: string; labelledBy: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const read = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      return Math.min(1, Math.max(0, (vh - r.top) / ((vh + r.height) / 2)));
    };
    const paint = (p: number) => {
      el.style.setProperty("--p", p.toFixed(4));
      // One-way: the button stays lit once the charge has reached it.
      if (p > 0.8) el.dataset.charged = "true";
    };

    let target = read();
    let current = target;
    let frame = 0;
    el.dataset.charged = String(current > 0.8);
    paint(current);

    // Eases towards the scroll position, so a mouse wheel's steps do not show.
    const tick = () => {
      current += (target - current) * 0.14;
      if (Math.abs(target - current) < 0.001) current = target;
      paint(current);
      frame = current === target ? 0 : requestAnimationFrame(tick);
    };
    const onScroll = () => {
      target = read();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    // Listens and paints the fixed layer only while the band is on screen.
    const observer = new IntersectionObserver(([entry]) => {
      el.dataset.visible = String(entry.isIntersecting);
      if (entry.isIntersecting) {
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        onScroll();
      } else {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section ref={ref} aria-labelledby={labelledBy} data-charged="true" data-visible="true" className={className}>
      {children}
    </section>
  );
}
