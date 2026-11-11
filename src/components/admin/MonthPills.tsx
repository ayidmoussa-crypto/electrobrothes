import Link from "next/link";
import type { AdminLang } from "@/lib/admin-tr";
import { adminLocale } from "@/lib/admin-tr";
import { monthRange, previousMonth } from "@/lib/staff-rules";
import { TIME_ZONE } from "@/lib/time";

/** Last month and this month as pills (pay is counted by the month), plus the one on screen if older. */
export function MonthPills({ basePath, current, lang }: { basePath: string; current: string; lang: AdminLang }) {
  const fmt = new Intl.DateTimeFormat(adminLocale(lang), { month: "long", year: "numeric", timeZone: TIME_ZONE });
  const thisMonth = monthRange(undefined).key;
  const keys = [...new Set([current, previousMonth(thisMonth), thisMonth])].sort();
  return keys.map((k) => (
    <Link
      key={k}
      href={`${basePath}?month=${k}`}
      aria-current={k === current ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${k === current ? "bg-ink text-white shadow-lg shadow-ink/20" : "admin-field text-ink hover:bg-white"}`}
    >
      {fmt.format(monthRange(k).start)}
    </Link>
  ));
}

export const monthTitle = (key: string, lang: AdminLang) =>
  new Intl.DateTimeFormat(adminLocale(lang), { month: "long", year: "numeric", timeZone: TIME_ZONE }).format(monthRange(key).start);
