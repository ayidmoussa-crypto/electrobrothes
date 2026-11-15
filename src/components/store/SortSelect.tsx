"use client";

import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Sort menu inside the listing GET form. Each choice is a submit button named "sort", so it works without
 * JS and for shopping agents; <details> opens it natively. JS only closes it on Escape or a click elsewhere.
 */
export function SortSelect({ label, value, options }: { label: string; value: string; options: { value: string; label: string }[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    const away = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <details ref={menu} className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-warm-200 bg-white px-3 text-sm font-semibold text-ink transition-colors select-none hover:border-warm-300 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 group-open:border-ink [&::-webkit-details-marker]:hidden">
        <ArrowDownUp className="size-4 text-warm-600" aria-hidden="true" />
        <span className="sr-only">{label}: </span>
        {current.label}
        <ChevronDown className="size-4 text-warm-600 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="animate-pop absolute end-0 top-full z-30 mt-2 w-60 ltr:origin-top-right rtl:origin-top-left rounded-xl border border-warm-200 bg-white p-1.5 shadow-xl shadow-ink/10">
        <p className="px-3 pt-1.5 pb-2 text-xs font-bold text-warm-600">{label}</p>
        {options.map((o) => {
          const on = o.value === current.value;
          return (
            <button
              key={o.value}
              type="submit"
              name="sort"
              value={o.value}
              aria-current={on ? "true" : undefined}
              className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 ${on ? "bg-yellow-100 font-bold text-yellow-900" : "font-medium text-warm-800 hover:bg-warm-100"}`}
            >
              <span className="flex-1">{o.label}</span>
              {on ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
