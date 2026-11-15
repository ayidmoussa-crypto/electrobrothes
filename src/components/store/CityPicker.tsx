"use client";

import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Select } from "@/components/ui/Field";
import type { Locale } from "@/i18n/routing";
import { formatMAD } from "@/lib/money";

const noSubscribe = () => () => {};

export type CityOption = { id: string; nameAr: string; nameEn: string; shippingFee: number };

// Typing "الدار البيضا" or "casa" finds the same city: no case, no tashkeel, one alif, one taa marbuta.
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();

/**
 * City field with a search box and each city's delivery fee. The server HTML (and a browser without JS)
 * gets a plain <select> with the same name and value; the picker replaces it once the page is live.
 */
export function CityPicker({
  id,
  name,
  value,
  onChange,
  cities,
  locale,
  placeholder,
  searchLabel,
  emptyLabel,
  className = "",
  ...aria
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (id: string) => void;
  cities: CityOption[];
  locale: Locale;
  placeholder: string;
  searchLabel: string;
  emptyLabel: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
}) {
  const ar = locale === "ar";
  const label = (c: CityOption) => (ar ? c.nameAr : c.nameEn);
  // false in the server HTML and during hydration, true once the page runs in the browser.
  const live = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const uid = useId();

  // Close on a tap or click anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const q = fold(query);
  const shown = q ? cities.filter((c) => fold(c.nameAr).includes(q) || fold(c.nameEn).includes(q)) : cities;
  const selected = cities.find((c) => c.id === value);

  // Keep the highlighted city in view while moving with the arrow keys.
  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!live) {
    return (
      <Select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="address-level2" className={className} {...aria}>
        <option value="">{placeholder}</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {label(c)} — {formatMAD(c.shippingFee, locale)}
          </option>
        ))}
      </Select>
    );
  }

  const openList = () => {
    setQuery("");
    setActive(Math.max(0, cities.findIndex((c) => c.id === value)));
    setOpen(true);
  };
  const pick = (c: CityOption) => {
    onChange(c.id);
    setOpen(false);
    trigger.current?.focus();
  };
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => Math.min(shown.length - 1, Math.max(0, a + step)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
  };

  return (
    <div ref={box} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openList();
          }
        }}
        className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-warm-200 bg-warm-100 px-4 text-start text-base transition-colors hover:border-warm-300 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 aria-invalid:border-danger aria-invalid:bg-danger-soft ${open ? "border-ink" : ""} ${className}`}
        {...aria}
      >
        <MapPin className="size-5 shrink-0 text-warm-600" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate ${selected ? "font-semibold text-ink" : "text-warm-600"}`}>{selected ? label(selected) : placeholder}</span>
        {selected ? <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-sm font-semibold text-warm-800">{formatMAD(selected.shippingFee, locale)}</span> : null}
        <ChevronDown className={`size-5 shrink-0 text-warm-600 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open ? (
        <div className="animate-pop absolute inset-x-0 top-full z-30 mt-2 origin-top overflow-hidden rounded-xl border border-warm-200 bg-white shadow-xl shadow-ink/10">
          <div className="relative border-b border-warm-200 p-2">
            <Search className="pointer-events-none absolute start-5 top-1/2 size-4 -translate-y-1/2 text-warm-500" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              enterKeyHint="search"
              role="combobox"
              aria-label={searchLabel}
              aria-expanded="true"
              aria-controls={`${uid}-list`}
              aria-autocomplete="list"
              aria-activedescendant={shown[active] ? `${uid}-${shown[active].id}` : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              placeholder={searchLabel}
              autoComplete="off"
              className="min-h-11 w-full rounded-lg bg-warm-100 ps-9 pe-3 text-base text-warm-800 placeholder:text-warm-400 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
            />
          </div>
          <ul ref={list} id={`${uid}-list`} role="listbox" aria-label={placeholder} className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
            {shown.map((c, i) => {
              const isSel = c.id === value;
              return (
                <li
                  key={c.id}
                  id={`${uid}-${c.id}`}
                  role="option"
                  aria-selected={isSel}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => pick(c)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm ${i === active ? "bg-yellow-100 text-yellow-900" : "text-warm-800"}`}
                >
                  <Check className={`size-4 shrink-0 ${isSel ? "" : "invisible"}`} aria-hidden="true" />
                  <span className={`flex-1 ${isSel ? "font-bold" : "font-medium"}`}>{label(c)}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMAD(c.shippingFee, locale)}</span>
                </li>
              );
            })}
            {!shown.length ? <li className="px-3 py-4 text-center text-sm text-warm-600">{emptyLabel}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
