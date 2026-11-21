"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

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
  const [thumb, setThumb] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const measure = useCallback(() => {
    const el = buttons.current[active];
    if (!el) return;
    setThumb({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
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

  const select = (i: number) => setActive(i);

  return (
    <>
      {/* The tabs wrap onto as many rows as the screen needs, centred: nothing is cut off or swiped. */}
      <div className="py-1">
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={onKey}
          className="relative isolate flex w-full flex-wrap justify-center gap-y-1 rounded-3xl bg-yellow-500 p-1 shadow-md shadow-ink/10 sm:inline-flex sm:w-auto sm:rounded-full"
        >
          <span
            aria-hidden="true"
            style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)`, width: thumb.w, height: thumb.h }}
            // Physical left-0: offsetLeft is measured from the left in both directions.
            // The same frosted glass as the floating header.
            className="absolute top-0 left-0 -z-10 glass-frost rounded-full border shadow-md shadow-ink/10 transition-[transform,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
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
              className={`min-h-12 grow cursor-pointer rounded-full px-4 text-[0.9375rem] font-extrabold whitespace-nowrap text-ink transition-opacity duration-300 sm:min-h-11 sm:grow-0 sm:px-6 sm:text-base ${
                i === active ? "" : "opacity-75 hover:opacity-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
