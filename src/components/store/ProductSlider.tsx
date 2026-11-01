"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal product row: native scroll + snap (swipe, trackpad, keyboard), no autoplay.
 * From md, round arrow buttons page through it and dim at either end. Works in RTL:
 * "next" always moves toward the reading end.
 */
export function ProductSlider({ children, label, prevLabel, nextLabel }: { children: ReactNode; label: string; prevLabel: string; nextLabel: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    // scrollLeft is negative in RTL; its magnitude is the distance from the start edge.
    const from = Math.abs(el.scrollLeft);
    setEdges({ start: from <= 2, end: from + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  // Re-measure on any size change, including a hidden tab panel becoming visible.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  const page = (step: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: step * (rtl ? -1 : 1) * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // Chevrons point the way the row moves: in Arabic "next" goes left.
  const arrow = "absolute top-[38%] z-10 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-warm-200 bg-white text-ink shadow-lg shadow-ink/10 transition-[opacity,background-color] hover:bg-yellow-500 active:bg-yellow-700 disabled:pointer-events-none disabled:opacity-0 max-md:hidden";

  return (
    <div className="relative">
      <ul
        ref={track}
        onScroll={update}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          // 2 cards and a peek on phones, 3 on tablets, 4 on desktop.
          <li className="flex w-[44%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-3rem)/4)]">
            <div className="flex-1">{child}</div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label={prevLabel} className={`${arrow} -start-3`}>
        <ChevronRight className="size-5 ltr:hidden" aria-hidden="true" />
        <ChevronLeft className="size-5 rtl:hidden" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label={nextLabel} className={`${arrow} -end-3`}>
        <ChevronLeft className="size-5 ltr:hidden" aria-hidden="true" />
        <ChevronRight className="size-5 rtl:hidden" aria-hidden="true" />
      </button>
    </div>
  );
}
