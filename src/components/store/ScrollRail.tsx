"use client";

import { useEffect, useRef } from "react";

/**
 * Thin rail that shows a row can be swiped sideways and how far along it you are.
 * Place it right after the scrolling element. It hides itself when everything fits. Works in RTL.
 */
export function ScrollRail({ className = "" }: { className?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = rail.current?.previousElementSibling;
    if (!el) return;
    const update = () => {
      const fits = el.scrollWidth <= el.clientWidth;
      rail.current?.toggleAttribute("hidden", fits);
      if (fits || !thumb.current) return;
      thumb.current.style.width = `${(el.clientWidth / el.scrollWidth) * 100}%`;
      // scrollLeft is negative in RTL; its magnitude is the distance from the start edge.
      thumb.current.style.insetInlineStart = `${(Math.abs(el.scrollLeft) / el.scrollWidth) * 100}%`;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    // Also runs when a hidden tab panel becomes visible.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rail} aria-hidden="true" className={`relative h-1 overflow-hidden rounded-full bg-warm-200 ${className}`}>
      <span ref={thumb} className="absolute inset-y-0 rounded-full bg-ink" />
    </div>
  );
}
