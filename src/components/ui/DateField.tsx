"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Popover, panelHost } from "./Popover";

// The one date (and date + time) picker of the shop and the admin, in place of the browser's own. It holds the same
// text a native date input holds: "2026-11-20", or "2026-11-20T14:30" with `time`. It submits with its form, can be
// required, resets with its form, and opens a month calendar; the time part is two scrolling lists.

export type DateChange = { target: { name: string; value: string }; currentTarget: { name: string; value: string } };

const WORDS = {
  ar: { pick: "اختر التاريخ", pickTime: "اختر التاريخ والوقت", today: "اليوم", clear: "مسح", done: "تم", hour: "الساعة", minute: "الدقيقة", prevMonth: "الشهر السابق", nextMonth: "الشهر التالي", prevYears: "الأعوام السابقة", nextYears: "الأعوام التالية", pickYear: "اختر العام", loc: "ar-u-nu-latn" },
  en: { pick: "Pick a date", pickTime: "Pick a date and time", today: "Today", clear: "Clear", done: "Done", hour: "Hour", minute: "Minute", prevMonth: "Previous month", nextMonth: "Next month", prevYears: "Earlier years", nextYears: "Later years", pickYear: "Choose a year", loc: "en-GB" },
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** "2026-11-20" or "2026-11-20T14:30" → its parts, or null when it is not a date. */
function parse(text: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const probe = new Date(Date.UTC(y, mo, d));
  if (probe.getUTCMonth() !== mo) return null;
  return { y, m: mo, d, h: m[4] ? Number(m[4]) : 0, min: m[5] ? Number(m[5]) : 0 };
}

const todayParts = () => {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
};

export function DateField({
  name,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  id,
  className = "",
  time = false,
  lang = "ar",
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: DateChange) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** The look of the closed box, e.g. the page's input class. */
  className?: string;
  /** Also ask for the time of day (what a datetime-local input asks for). */
  time?: boolean;
  lang?: "ar" | "en";
  "aria-label"?: string;
}) {
  const w = WORDS[lang];
  const uid = useId();
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = controlled ? value : inner;
  const parts = parse(current);
  const [open, setOpen] = useState(false);
  const [years, setYears] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const [view, setView] = useState(() => parts ?? { ...todayParts(), h: 0, min: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const initial = useRef(defaultValue ?? "");

  useEffect(() => {
    const form = field.current?.form;
    if (!form || controlled) return;
    const reset = () => setInner(initial.current);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled]);

  const emit = (next: string) => {
    if (!controlled) setInner(next);
    onChange?.({ target: { name: name ?? "", value: next }, currentTarget: { name: name ?? "", value: next } });
  };

  const show = () => {
    setHost(panelHost(button.current));
    setYears(false);
    setView(parse(current) ?? { ...todayParts(), h: 0, min: 0 });
    setOpen(true);
  };

  const compose = (y: number, m: number, d: number, h: number, min: number) => (time ? `${ymd(y, m, d)}T${pad(h)}:${pad(min)}` : ymd(y, m, d));
  const pickDay = (d: number) => {
    emit(compose(view.y, view.m, d, parts?.h ?? 12, parts?.min ?? 0));
    if (!time) {
      setOpen(false);
      button.current?.focus({ preventScroll: true });
    }
  };
  const pickTime = (h: number, min: number) => {
    const day = parts ?? { ...todayParts(), h: 0, min: 0 };
    emit(compose(day.y, day.m, day.d, h, min));
  };
  const shift = (months: number) =>
    setView((v) => {
      const t = v.y * 12 + v.m + months;
      return { ...v, y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });

  // Month grid, weeks start on Monday.
  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const lead = (first + 6) % 7;
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => (i >= lead && i < lead + days ? i - lead + 1 : 0));
  const monthTitle = new Intl.DateTimeFormat(w.loc, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(view.y, view.m, 1)));
  const weekday = new Intl.DateTimeFormat(w.loc, { weekday: "narrow", timeZone: "UTC" });
  const heads = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(Date.UTC(2024, 0, 1 + i))));
  const now = todayParts();
  const yearsFrom = view.y - 4;

  const shown = parts
    ? new Intl.DateTimeFormat(w.loc, { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}), timeZone: "UTC" }).format(
        new Date(Date.UTC(parts.y, parts.m, parts.d, parts.h, parts.min)),
      )
    : null;

  const nav = "grid size-9 cursor-pointer place-items-center rounded-lg text-warm-700 transition-colors hover:bg-warm-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300";
  const flip = lang === "ar";

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${uid}-panel` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        className={`${className} flex cursor-pointer items-center justify-between gap-2 text-start transition-colors hover:border-warm-300 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:text-warm-400`}
      >
        <span dir="ltr" className={`min-w-0 flex-1 truncate text-start ${shown ? "" : "text-warm-500"}`}>
          {shown ?? (time ? w.pickTime : w.pick)}
        </span>
        <CalendarDays className="size-4 shrink-0 text-warm-500" aria-hidden="true" />
      </button>

      {/* What the form sends (when named), and what makes `required` work: a field a browser can focus and mark. */}
      <input ref={field} tabIndex={-1} aria-hidden="true" name={name} value={current} required={required} disabled={disabled} onChange={() => {}} onFocus={() => button.current?.focus()} className="sr-only" />

      <Popover anchor={button} host={host} open={open} onClose={() => setOpen(false)} minWidth={312} estimate={time ? 580 : 400} id={`${uid}-panel`} role="dialog" aria-label={ariaLabel ?? (time ? w.pickTime : w.pick)} className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label={years ? w.prevYears : w.prevMonth} onClick={() => shift(years ? -144 : -1)} className={nav}>
            {flip ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronLeft className="size-4" aria-hidden="true" />}
          </button>
          {/* The month and year: a tap opens the years, for a date far from today. */}
          <button
            type="button"
            aria-live="polite"
            aria-label={w.pickYear}
            onClick={() => setYears((y) => !y)}
            className="min-h-9 cursor-pointer rounded-lg px-3 text-sm font-bold whitespace-nowrap text-ink transition-colors hover:bg-warm-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
          >
            {years ? `${yearsFrom} – ${yearsFrom + 11}` : monthTitle}
          </button>
          <button type="button" aria-label={years ? w.nextYears : w.nextMonth} onClick={() => shift(years ? 144 : 1)} className={nav}>
            {flip ? <ChevronLeft className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          </button>
        </div>

        {years ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => yearsFrom + i).map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === view.y}
                onClick={() => {
                  setView((v) => ({ ...v, y }));
                  setYears(false);
                }}
                className={`grid h-11 cursor-pointer place-items-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 ${
                  y === view.y ? "bg-yellow-500 text-ink hover:bg-yellow-600" : `text-ink hover:bg-warm-100 ${y === now.y ? "ring-1 ring-inset ring-warm-300" : ""}`
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        ) : (
          <>
        <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold text-warm-500" aria-hidden="true">
          {heads.map((h, i) => (
            <span key={i} className="py-1">
              {h}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-x-1 gap-y-0.5" role="grid">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const isSelected = !!parts && parts.y === view.y && parts.m === view.m && parts.d === d;
            const isToday = now.y === view.y && now.m === view.m && now.d === d;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                onClick={() => pickDay(d)}
                className={`grid h-9 cursor-pointer place-items-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 ${
                  isSelected ? "bg-yellow-500 text-ink hover:bg-yellow-600" : `text-ink hover:bg-warm-100 ${isToday ? "ring-1 ring-inset ring-warm-300" : ""}`
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
          </>
        )}

        {time && !years ? (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-warm-200 pt-3" dir="ltr">
            <TimeList label={w.hour} count={24} value={parts?.h ?? null} onPick={(h) => pickTime(h, parts?.min ?? 0)} />
            <TimeList label={w.minute} count={60} value={parts?.min ?? null} onPick={(m) => pickTime(parts?.h ?? 12, m)} />
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-warm-200 pt-2.5">
          <button
            type="button"
            onClick={() => {
              const t = todayParts();
              setView({ ...t, h: 0, min: 0 });
              if (!time) {
                emit(ymd(t.y, t.m, t.d));
                setOpen(false);
              } else {
                const n = new Date();
                emit(compose(t.y, t.m, t.d, n.getHours(), n.getMinutes()));
              }
            }}
            className="min-h-9 cursor-pointer rounded-lg px-3 text-sm font-bold text-ink hover:bg-warm-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
          >
            {w.today}
          </button>
          <div className="flex gap-1">
            {!required && current ? (
              <button
                type="button"
                onClick={() => {
                  emit("");
                  setOpen(false);
                }}
                className="min-h-9 cursor-pointer rounded-lg px-3 text-sm font-semibold text-warm-600 hover:bg-warm-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
              >
                {w.clear}
              </button>
            ) : null}
            {time ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-9 cursor-pointer rounded-lg bg-yellow-500 px-4 text-sm font-bold text-ink hover:bg-yellow-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
              >
                {w.done}
              </button>
            ) : null}
          </div>
        </div>
      </Popover>
    </>
  );
}

/** A scrolling list of 00…count-1; the chosen one is shown and scrolled to when the panel opens. */
function TimeList({ label, count, value, onPick }: { label: string; count: number; value: number | null; onPick: (n: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = list.current?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (on && list.current) list.current.scrollTop = on.offsetTop - list.current.clientHeight / 2 + on.clientHeight / 2;
  }, []);
  return (
    <div>
      <p className="mb-1 text-center text-xs font-semibold text-warm-500">{label}</p>
      <div ref={list} role="group" aria-label={label} className="relative h-36 overflow-y-auto rounded-lg bg-warm-50 p-1">
        {Array.from({ length: count }, (_, n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onPick(n)}
            className={`grid h-8 w-full cursor-pointer place-items-center rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 ${value === n ? "bg-yellow-500 text-ink" : "text-ink hover:bg-warm-100"}`}
          >
            {pad(n)}
          </button>
        ))}
      </div>
    </div>
  );
}
