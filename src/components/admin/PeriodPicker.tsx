import { CalendarRange } from "lucide-react";
import Link from "next/link";
import { PRESETS, presetName, type Period } from "@/lib/period";

/**
 * The period choice shared by the dashboard and finance pages: ready spans, calendar months, and any two dates
 * typed by hand. Plain links and a GET form, so the chosen period lives in the address and works without JS.
 */
export function PeriodPicker({ basePath, period, lang, label }: { basePath: string; period: Period; lang: "ar" | "en"; label: string }) {
  const ar = lang === "ar";
  const custom = period.preset === null;
  const pill = (on: boolean) =>
    `inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${on ? "bg-ink text-white" : "text-warm-700 hover:bg-white hover:text-ink"}`;
  const field = "min-h-11 w-full rounded-lg border border-warm-200 bg-white px-3 text-base text-warm-800";

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1 rounded-3xl bg-warm-100 p-1">
      {PRESETS.map((p) => (
        <Link key={p} href={`${basePath}?p=${p}`} aria-current={p === period.preset ? "page" : undefined} className={pill(p === period.preset)}>
          {presetName(p, lang)}
        </Link>
      ))}
      <details className="group relative">
        <summary className={`${pill(custom)} list-none [&::-webkit-details-marker]:hidden`}>
          <CalendarRange className="size-4" aria-hidden="true" />
          {ar ? "تواريخ أخرى" : "Custom dates"}
        </summary>
        <form method="get" action={basePath} className="glass-frost absolute end-0 top-full z-20 mt-2 flex w-72 flex-col gap-3 rounded-2xl border p-4 shadow-xl shadow-ink/15">
          <label className="flex flex-col gap-1 text-xs font-semibold text-warm-600">
            {ar ? "من" : "From"}
            <input type="date" name="from" required defaultValue={period.firstDay} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-warm-600">
            {ar ? "حتى" : "To"}
            <input type="date" name="to" required defaultValue={period.lastDay} className={field} />
          </label>
          <button type="submit" className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-yellow-500 px-5 font-extrabold text-ink transition-colors hover:bg-yellow-600 active:bg-yellow-700">
            {ar ? "عرض" : "Show"}
          </button>
        </form>
      </details>
    </nav>
  );
}
