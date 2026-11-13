// The time span the dashboard and finance pages report on, read from the page's address so it can be bookmarked.
// The shop keeps its days in UTC (lib/time.ts), so a day here is a UTC calendar day.

const DAY = 24 * 3600 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const startOfDay = (ms: number) => Date.parse(iso(ms));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Custom dates reach back 20 years at most. */
const MAX_DAYS = 20 * 366;

export const PRESETS = ["7d", "30d", "90d", "365d", "month", "lastMonth"] as const;
export type Preset = (typeof PRESETS)[number];

export type Period = {
  /** null when the admin typed the dates. */
  preset: Preset | null;
  /** First instant counted. */
  from: Date;
  /** Last instant counted: now, or the end of the last chosen day. */
  until: Date;
  /** Calendar days covered, both ends included. */
  days: number;
  firstDay: string;
  lastDay: string;
  /** The same length of time just before: [prevFrom, from). */
  prevFrom: Date;
  /** The address query that brings this period back, for links. */
  query: string;
};

type Params = { p?: string | string[]; from?: string | string[]; to?: string | string[]; days?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const validDate = (s: string | undefined): s is string => !!s && DATE.test(s) && !Number.isNaN(Date.parse(s)) && iso(Date.parse(s)) === s;

function build(preset: Preset | null, from: number, until: number, query: string): Period {
  const length = until + 1 - from;
  return {
    preset,
    from: new Date(from),
    until: new Date(until),
    days: Math.round((startOfDay(until) - from) / DAY) + 1,
    firstDay: iso(from),
    lastDay: iso(until),
    prevFrom: new Date(from - length),
    query,
  };
}

/** Reads ?p=30d, ?from=2024-01-01&to=2026-11-13, or the older ?days=30. Anything else: the last 30 days. */
export function resolvePeriod(params: Params, now = new Date()): Period {
  const nowMs = now.getTime();
  const today = startOfDay(nowMs);
  const from = one(params.from);
  const to = one(params.to);

  if (validDate(from) && validDate(to)) {
    let a = Date.parse(from);
    let b = Date.parse(to);
    if (a > b) [a, b] = [b, a];
    b = Math.min(b, today);
    a = Math.max(Math.min(a, b), b - (MAX_DAYS - 1) * DAY);
    const until = b === today ? nowMs : b + DAY - 1;
    return build(null, a, until, `from=${iso(a)}&to=${iso(b)}`);
  }

  const asked = one(params.p) ?? (one(params.days) ? `${one(params.days)}d` : undefined);
  const preset: Preset = (PRESETS as readonly string[]).includes(asked ?? "") ? (asked as Preset) : "30d";
  const d = new Date(today);
  const query = `p=${preset}`;
  if (preset === "month") return build(preset, Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), nowMs, query);
  if (preset === "lastMonth") {
    const thisMonth = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    return build(preset, Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1), thisMonth - 1, query);
  }
  const n = Number(preset.slice(0, -1));
  return build(preset, today - (n - 1) * DAY, nowMs, query);
}

const short = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** The words for a period inside a sentence or a title: "آخر 30 يوم", "this month", "أكتوبر 2026", "01/01/2024 – 13/11/2026". */
export function periodLabel(p: Period, lang: "ar" | "en") {
  const ar = lang === "ar";
  if (p.preset === "month") return ar ? "هاد الشهر" : "this month";
  if (p.preset === "lastMonth") return new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(p.from);
  if (p.preset) {
    const n = Number(p.preset.slice(0, -1));
    return ar ? `آخر ${n} يوم` : `last ${n} days`;
  }
  return `${short.format(p.from)} – ${short.format(new Date(Date.parse(p.lastDay)))}`;
}

/** The short name on each choice of the period picker. */
export function presetName(preset: Preset, lang: "ar" | "en") {
  const ar = lang === "ar";
  if (preset === "month") return ar ? "هاد الشهر" : "This month";
  if (preset === "lastMonth") return ar ? "الشهر اللي فات" : "Last month";
  const n = preset.slice(0, -1);
  return ar ? `${n} يوم` : `${n} days`;
}

/**
 * Orders per day turned into chart points for the whole period: one per day up to a quarter, then one per month
 * so years stay readable. `key` is the slot's first day (YYYY-MM-DD).
 */
export function chartSlots(rows: { day: string; count: number }[], p: Period) {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const start = Date.parse(p.firstDay);
  if (p.days <= 92) {
    return { monthly: false, points: Array.from({ length: p.days }, (_, i) => ({ key: iso(start + i * DAY), count: byDay.get(iso(start + i * DAY)) ?? 0 })) };
  }
  const months = new Map<string, number>();
  for (let ms = start; ms <= Date.parse(p.lastDay); ms += DAY) {
    const key = `${iso(ms).slice(0, 7)}-01`;
    months.set(key, (months.get(key) ?? 0) + (byDay.get(iso(ms)) ?? 0));
  }
  return { monthly: true, points: [...months].map(([key, count]) => ({ key, count })) };
}

/** The same number of slots just before the period, slot for slot with chartSlots: the dashed "before" line. */
export function previousSlots(rows: { day: string; count: number }[], p: Period) {
  const { monthly, points } = chartSlots([], p);
  if (!monthly) {
    const byDay = new Map(rows.map((r) => [r.day, r.count]));
    const start = Date.parse(p.firstDay) - p.days * DAY;
    return points.map((_, i) => byDay.get(iso(start + i * DAY)) ?? 0);
  }
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(r.day.slice(0, 7), (byMonth.get(r.day.slice(0, 7)) ?? 0) + r.count);
  // Months between the start of the period before and this one's start: 12 for a year.
  const a = p.prevFrom;
  const b = p.from;
  const shift = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
  return points.map(({ key }) => {
    const d = new Date(key);
    return byMonth.get(iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - shift, 1)).slice(0, 7)) ?? 0;
  });
}
