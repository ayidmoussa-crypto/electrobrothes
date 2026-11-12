"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dots under a row that can be swiped sideways: one per screenful, the current one stretched.
 * Place it right after the scrolling element. It hides itself when everything fits. Works in RTL.
 */
export function ScrollRail({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  const [on, off] = onDark ? ["bg-yellow-500", "bg-warm-700"] : ["bg-ink", "bg-warm-300"];
  const rail = useRef<HTMLDivElement>(null);
  const [{ pages, at }, setState] = useState({ pages: 0, at: 0 });

  useEffect(() => {
    const el = rail.current?.previousElementSibling;
    if (!el) return;
    const update = () => {
      const room = el.scrollWidth - el.clientWidth;
      const pages = room > 2 ? Math.ceil(el.scrollWidth / el.clientWidth - 0.05) : 0;
      // scrollLeft is negative in RTL; its magnitude is the distance from the start edge.
      const at = pages ? Math.round((Math.abs(el.scrollLeft) / room) * (pages - 1)) : 0;
      setState((s) => (s.pages === pages && s.at === at ? s : { pages, at }));
    };
    el.addEventListener("scroll", update, { passive: true });
    // Fires once on observe, and again when a hidden tab panel becomes visible.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rail} aria-hidden="true" hidden={pages < 2} className={`flex items-center justify-center gap-1.5 ${className}`}>
      {Array.from({ length: pages }, (_, i) => (
        <span key={i} className={`h-2 rounded-full transition-all duration-300 ${i === at ? `w-6 ${on}` : `w-2 ${off}`}`} />
      ))}
    </div>
  );
}
