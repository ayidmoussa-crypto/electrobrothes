"use client";

import { Select } from "@/components/ui/Select";
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { presetName, type Preset } from "@/lib/period";

/** Shown in the row: the everyday choices. The rest sit in the dates panel. */
const ROW: Preset[] = ["7d", "30d", "month", "lastMonth"];
const MORE: Preset[] = ["90d", "365d"];

const DAY = 24 * 3600 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The period choice shared by the dashboard and finance pages: everyday spans in a row, and a panel with the
 * longer spans and a range calendar for any two dates. The period lives in the address (?p= or ?from=&to=).
 */
export function PeriodPicker({
  basePath,
  preset,
  firstDay,
  lastDay,
  today,
  lang,
  label,
}: {
  basePath: string;
  preset: Preset | null;
  firstDay: string;
  lastDay: string;
  /** The shop's today (YYYY-MM-DD), from the server so both renders agree. */
  today: string;
  lang: "ar" | "en";
  label: string;
}) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLElement>(null);

  // A tap outside or Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    // A month or year list opened inside the panel is drawn elsewhere on the page: it is not "outside".
    const away = (e: PointerEvent) =>
      !box.current?.contains(e.target as Node) &&
      !(e.target as Element).closest("[data-popover]") &&
      setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pill = (on: boolean) =>
    `inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${on ? "bg-ink text-white" : "text-warm-700 hover:bg-white hover:text-ink"}`;
  // The panel's button says what is chosen inside it.
  const inPanel = preset === null || MORE.includes(preset);
  const panelLabel =
    preset === null
      ? rangeText(firstDay, lastDay)
      : preset && MORE.includes(preset)
        ? presetName(preset, lang)
        : ar
          ? "تواريخ أخرى"
          : "More dates";

  return (
    <nav
      ref={box}
      aria-label={label}
      className="relative flex flex-wrap items-center gap-1 rounded-3xl bg-warm-100 p-1"
    >
      {ROW.map((p) => (
        <Link
          key={p}
          href={`${basePath}?p=${p}`}
          onClick={() => setOpen(false)}
          aria-current={p === preset ? "page" : undefined}
          className={pill(p === preset)}
        >
          {presetName(p, lang)}
        </Link>
      ))}
      {/* On wide screens the panel hangs from this button; on phones it spans the whole bar. */}
      <div className="sm:relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={pill(inPanel || open)}
        >
          <CalendarRange className="size-4" aria-hidden="true" />
          <span dir={preset === null ? "ltr" : undefined}>{panelLabel}</span>
          <ChevronDown
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {open ? (
          // Above the assistant's floating button (z-40), which would cover "Show" on phones.
          <div className="glass-frost absolute inset-x-0 top-full z-50 mt-2 rounded-3xl border p-3 shadow-xl shadow-ink/15 sm:inset-x-auto sm:start-0 sm:w-[22rem]">
            <p className="px-1 text-xs font-bold text-warm-600">
              {ar ? "فترات جاهزة" : "Ready spans"}
            </p>
            <div className="mt-2 flex gap-2">
              {MORE.map((p) => (
                <Link
                  key={p}
                  href={`${basePath}?p=${p}`}
                  onClick={() => setOpen(false)}
                  aria-current={p === preset ? "page" : undefined}
                  className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-full text-sm font-bold transition-colors ${p === preset ? "bg-ink text-white" : "bg-white/70 text-ink hover:bg-white"}`}
                >
                  {presetName(p, lang)}
                </Link>
              ))}
            </div>
            <p className="mt-4 px-1 text-xs font-bold text-warm-600">
              {ar ? "ولا اختار التواريخ بيدك" : "Or pick the dates"}
            </p>
            <RangeCalendar
              basePath={basePath}
              first={preset === null ? firstDay : null}
              last={preset === null ? lastDay : null}
              today={today}
              lang={lang}
            />
          </div>
        ) : null}
      </div>
    </nav>
  );
}

const short = (d: string) =>
  `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const rangeText = (a: string, b: string) =>
  a === b ? short(a) : `${short(a)} – ${short(b)}`;

/**
 * A month grid in the brand's colours: the first tap sets the start, the second the end (swapped if earlier).
 * Weeks start on Monday, days after today cannot be picked, and month and year jump straight to any date.
 */
function RangeCalendar({
  basePath,
  first,
  last,
  today,
  lang,
}: {
  basePath: string;
  first: string | null;
  last: string | null;
  today: string;
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const router = useRouter();
  const [from, setFrom] = useState<string | null>(first);
  const [to, setTo] = useState<string | null>(last);
  const shown = Date.parse(last ?? today);
  const [view, setView] = useState({
    y: new Date(shown).getUTCFullYear(),
    m: new Date(shown).getUTCMonth(),
  });

  const loc = ar ? "ar-MA" : "en-GB";
  const monthName = new Intl.DateTimeFormat(loc, {
    month: "long",
    timeZone: "UTC",
  });
  const weekday = new Intl.DateTimeFormat(loc, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  const todayMs = Date.parse(today);
  const thisYear = new Date(todayMs).getUTCFullYear();

  const start = Date.UTC(view.y, view.m, 1);
  const lead = (new Date(start).getUTCDay() + 6) % 7; // Monday first
  const inMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: inMonth }, (_, i) => iso(start + i * DAY)),
  ];
  // Mon 2024-01-01 … Sun 2024-01-07, for the column heads.
  const heads = Array.from({ length: 7 }, (_, i) =>
    weekday.format(new Date(Date.UTC(2024, 0, 1 + i))),
  );

  const move = (step: number) =>
    setView((v) => ({
      y: v.y + Math.floor((v.m + step) / 12),
      m: (((v.m + step) % 12) + 12) % 12,
    }));
  const canNext = Date.UTC(view.y, view.m + 1, 1) <= todayMs;
  const pick = (d: string) => {
    if (!from || to) {
      setFrom(d);
      setTo(null);
    } else if (d < from) {
      setTo(from);
      setFrom(d);
    } else setTo(d);
  };
  const select =
    "min-h-9 cursor-pointer rounded-lg border border-warm-200 bg-white px-2 text-sm font-bold text-ink";

  return (
    <div className="mt-2 rounded-2xl bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label={ar ? "الشهر اللي قبل" : "Previous month"}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-ink hover:bg-warm-100"
        >
          <ChevronRight className="size-5 ltr:rotate-180" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1.5">
          <Select
            aria-label={ar ? "الشهر" : "Month"}
            value={view.m}
            onChange={(e) =>
              setView((v) => ({ ...v, m: Number(e.target.value) }))
            }
            className={select}
          >
            {Array.from({ length: 12 }, (_, m) => (
              <option
                key={m}
                value={m}
                disabled={
                  view.y === thisYear && Date.UTC(view.y, m, 1) > todayMs
                }
              >
                {monthName.format(new Date(Date.UTC(2024, m, 1)))}
              </option>
            ))}
          </Select>
          <Select
            aria-label={ar ? "العام" : "Year"}
            value={view.y}
            onChange={(e) =>
              setView((v) => ({
                y: Number(e.target.value),
                m:
                  Number(e.target.value) === thisYear
                    ? Math.min(v.m, new Date(todayMs).getUTCMonth())
                    : v.m,
              }))
            }
            className={select}
          >
            {Array.from({ length: 20 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={!canNext}
          aria-label={ar ? "الشهر اللي من بعد" : "Next month"}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-ink hover:bg-warm-100 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-5 ltr:rotate-180" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-xs font-bold text-warm-500">
        {heads.map((h, i) => (
          <span key={i} className="py-1">
            {h}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const end = d === from || d === to;
          const between = from && to && d > from && d < to;
          const future = Date.parse(d) > todayMs;
          // A pale band joins the two ends; at each end it fills only the half facing the other end.
          const span = from && to && from !== to;
          return (
            <span
              key={d}
              className={`relative flex justify-center ${between ? "bg-yellow-100" : ""}`}
            >
              {span && d === from ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 end-0 w-1/2 bg-yellow-100"
                />
              ) : null}
              {span && d === to ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 start-0 w-1/2 bg-yellow-100"
                />
              ) : null}
              <button
                type="button"
                disabled={future}
                onClick={() => pick(d)}
                aria-pressed={end}
                aria-label={d}
                className={`relative grid size-9 cursor-pointer place-items-center rounded-full text-sm tabular-nums transition-colors disabled:cursor-default disabled:text-warm-300 ${
                  end
                    ? "bg-yellow-500 font-extrabold text-ink"
                    : between
                      ? "font-semibold text-yellow-900 hover:bg-yellow-200"
                      : d === today
                        ? "font-extrabold text-ink ring-1 ring-ink ring-inset hover:bg-warm-100"
                        : "text-warm-800 hover:bg-warm-100"
                }`}
              >
                {Number(d.slice(8))}
              </button>
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-warm-200 pt-3">
        <p className="min-w-0 text-sm font-bold text-ink" dir="ltr">
          {from ? (
            rangeText(from, to ?? from)
          ) : (
            <span className="font-semibold text-warm-600">
              {ar ? "اختار نهار البداية" : "Pick the first day"}
            </span>
          )}
        </p>
        <button
          type="button"
          disabled={!from}
          onClick={() =>
            from && router.push(`${basePath}?from=${from}&to=${to ?? from}`)
          }
          className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-yellow-500 px-5 text-sm font-extrabold text-ink transition-colors hover:bg-yellow-600 active:bg-yellow-700 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400"
        >
          {ar ? "عرض" : "Show"}
        </button>
      </div>
    </div>
  );
}
