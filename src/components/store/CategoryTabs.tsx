"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ScrollRail } from "./ScrollRail";

type Tab = { slug: string; label: string; panel: ReactNode };

/**
 * Category switcher: a yellow pill track where a frosted-glass thumb glides to the chosen category, and
 * one product slider per category below it (all rendered on the server; only the chosen one is shown).
 * ARIA tabs pattern: arrow keys move between tabs, Home/End jump to the ends.
 */
export function CategoryTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const id = useId();
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });

  const measure = useCallback(() => {
    const el = buttons.current[active];
    if (!el) return;
    setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const onKey = (e: KeyboardEvent) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    let next = step === undefined ? -1 : (active + step + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
    buttons.current[next]?.focus();
  };

  // On phones the track scrolls: bring the chosen tab to its middle, so the next ones show on both sides.
  const select = (i: number) => {
    setActive(i);
    const tab = buttons.current[i];
    const track = tab?.parentElement;
    if (!tab || !track) return;
    // Moves the track only, never the page. A physical distance, so it holds in RTL too.
    const a = tab.getBoundingClientRect();
    const b = track.getBoundingClientRect();
    track.scrollBy({ left: a.left + a.width / 2 - (b.left + b.width / 2), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <>
      {/* Phones: full names at a readable size, in a track you swipe, cut off by its own rounded end; from sm it hugs its tabs. */}
      <div className="py-1">
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={onKey}
          className="relative isolate flex w-full overflow-x-auto rounded-full bg-yellow-500 p-1 shadow-md shadow-ink/10 [scrollbar-width:none] sm:inline-flex sm:w-auto sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          <span
            aria-hidden="true"
            style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }}
            // Physical left-0: offsetLeft is measured from the left in both directions.
            // The same frosted glass as the floating header.
            className="absolute inset-y-1 left-0 -z-10 glass-frost rounded-full border shadow-md shadow-ink/10 transition-[transform,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          />
          {tabs.map((tab, i) => (
            <button
              key={tab.slug}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${id}-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => select(i)}
              className={`min-h-12 shrink-0 cursor-pointer rounded-full px-5 text-[0.9375rem] font-extrabold whitespace-nowrap text-ink transition-opacity duration-300 sm:min-h-11 sm:px-6 sm:text-base ${
                i === active ? "" : "opacity-75 hover:opacity-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ScrollRail className="mx-auto mt-3 w-1/2 sm:hidden" />
      </div>

      {tabs.map((tab, i) => (
        <div
          key={tab.slug}
          role="tabpanel"
          id={`${id}-panel-${i}`}
          aria-labelledby={`${id}-tab-${i}`}
          hidden={i !== active}
          className="mt-6 animate-[tab-in_400ms_cubic-bezier(0.22,1,0.36,1)]"
        >
          {tab.panel}
        </div>
      ))}
    </>
  );
}
