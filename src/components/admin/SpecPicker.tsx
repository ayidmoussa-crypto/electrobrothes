"use client";

import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, Headphones, PencilLine, PlugZap, SlidersHorizontal, Smartphone } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type SpecGroup = { label: string; icon: LucideIcon; keys: [string, string][] };

// The spec keys the shop uses, by family. The first family shows as filters on category pages.
export const SPEC_GROUPS: SpecGroup[] = [
  {
    label: "فلاتر الأقسام",
    icon: SlidersHorizontal,
    keys: [
      ["ram", "الذاكرة (RAM)"],
      ["storage", "التخزين"],
      ["screen", "الشاشة"],
      ["cpu", "المعالج"],
    ],
  },
  {
    label: "هواتف وساعات",
    icon: Smartphone,
    keys: [
      ["gpu", "معالج الرسوميات"],
      ["camera", "الكاميرا"],
      ["battery", "البطارية"],
      ["water", "مقاومة الماء"],
    ],
  },
  {
    label: "سماعات وصوت",
    icon: Headphones,
    keys: [
      ["type", "النوع"],
      ["anc", "عزل الضوضاء (ANC)"],
      ["connectivity", "الاتصال"],
    ],
  },
  {
    label: "شواحن وكابلات",
    icon: PlugZap,
    keys: [
      ["power", "القدرة"],
      ["port", "المنفذ"],
      ["capacity", "السعة"],
      ["length", "الطول"],
    ],
  },
];
export const KNOWN_SPECS = new Set(SPEC_GROUPS.flatMap((g) => g.keys.map(([k]) => k)));
export const FILTER_SPECS = new Set(SPEC_GROUPS[0].keys.map(([k]) => k));
const LABEL = new Map(SPEC_GROUPS.flatMap((g) => g.keys));
const groupOf = (key: string) => SPEC_GROUPS.findIndex((g) => g.keys.some(([k]) => k === key));

/**
 * Picks a spec key in two steps: the families first, and a family opens to show its specs (the one holding the
 * current choice starts open). "Other" asks for a key of its own. Closes on a pick, a click outside or Escape.
 */
export function SpecPicker({ value, custom, onPick, onOther }: { value: string; custom: boolean; onPick: (key: string) => void; onOther: () => void }) {
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<number>(-1);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const label = custom ? "مواصفة أخرى" : value ? (LABEL.get(value) ?? value) : "اختر المواصفة";
  const pick = (key: string) => {
    onPick(key);
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`المواصفة: ${label}`}
        onClick={() => {
          setFamily(groupOf(value));
          setOpen((o) => !o);
        }}
        className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 text-start text-base transition-colors ${
          open ? "border-ink" : "border-warm-200 hover:border-warm-300"
        } ${value || custom ? "text-warm-800" : "text-warm-500"}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`size-4 shrink-0 text-warm-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open ? (
        <div id={listId} className="absolute inset-x-0 top-full z-30 mt-1.5 min-w-60 overflow-hidden rounded-xl border border-warm-200 bg-white p-1.5 shadow-xl shadow-ink/10">
          <ul className="flex flex-col gap-0.5">
            {SPEC_GROUPS.map((g, gi) => {
              const expanded = family === gi;
              const holds = groupOf(value) === gi;
              return (
                <li key={g.label}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setFamily(expanded ? -1 : gi)}
                    className={`flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-start text-sm font-semibold transition-colors ${
                      expanded ? "bg-warm-100 text-ink" : "text-warm-800 hover:bg-warm-50"
                    }`}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-md ${holds ? "bg-yellow-500 text-ink" : "bg-warm-100 text-warm-700"}`}>
                      <g.icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex-1">{g.label}</span>
                    <span className="text-xs font-normal text-warm-500 tabular-nums">{g.keys.length}</span>
                    <ChevronDown className={`size-4 shrink-0 text-warm-500 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {expanded ? (
                    <ul className="my-1 ms-6 flex flex-col gap-0.5 border-s border-warm-200 ps-2">
                      {g.keys.map(([k, name]) => {
                        const chosen = k === value && !custom;
                        return (
                          <li key={k}>
                            <button
                              type="button"
                              onClick={() => pick(k)}
                              aria-current={chosen ? "true" : undefined}
                              className={`flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 text-start text-sm transition-colors ${
                                chosen ? "bg-yellow-100 font-semibold text-yellow-900" : "text-warm-700 hover:bg-warm-100 hover:text-ink"
                              }`}
                            >
                              {name}
                              {chosen ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-1 border-t border-warm-200 pt-1">
            <button
              type="button"
              onClick={() => {
                onOther();
                setOpen(false);
              }}
              className={`flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-start text-sm font-semibold transition-colors ${
                custom ? "bg-yellow-100 text-yellow-900" : "text-warm-800 hover:bg-warm-50"
              }`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-warm-100 text-warm-700">
                <PencilLine className="size-3.5" aria-hidden="true" />
              </span>
              مواصفة أخرى…
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
