"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Several home offers side by side: the shopper swipes (CSS scroll snap, no auto-play, no animation library). The
 * small bars underneath show which one is on screen and jump to another. One offer: no bars, no listener.
 */
export function OfferSlider({ children, count, label, slideLabels }: { children: ReactNode; count: number; label: string; slideLabels: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el || count < 2) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root: el, threshold: 0.6 },
    );
    for (const slide of el.children) io.observe(slide);
    return () => io.disconnect();
  }, [count]);

  // Moves the track only (scrollIntoView would also scroll the page), by the slide's distance on screen, which is
  // right in RTL and LTR alike.
  const go = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: slide.getBoundingClientRect().left - el.getBoundingClientRect().left, behavior: still ? "auto" : "smooth" });
  };

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={slideLabels[i]}
              aria-current={active === i ? "true" : undefined}
              // 44px tall touch target around a thin bar.
              className="group flex h-11 w-9 cursor-pointer items-center"
            >
              <span className={`h-1 w-full rounded-full ${active === i ? "bg-yellow-500" : "bg-warm-400 group-hover:bg-warm-300"}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
