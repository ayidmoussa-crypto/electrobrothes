import type { OrderStatus } from "./order-rules";

export type StatusCounts = Partial<Record<OrderStatus, number>>;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/**
 * COD funnel rates. Confirmation is measured on orders already handled (not still NEW);
 * delivery and return rates on orders that reached an outcome (delivered or returned).
 */
export function codRates(c: StatusCounts) {
  const n = (s: OrderStatus) => c[s] ?? 0;
  const total = Object.values(c).reduce((a, b) => a + (b ?? 0), 0);
  const handled = total - n("NEW");
  const confirmed = n("CONFIRMED") + n("SHIPPING") + n("DELIVERED") + n("RETURNED");
  const outcome = n("DELIVERED") + n("RETURNED");
  return {
    total,
    pending: n("NEW"),
    confirmation: pct(confirmed, handled),
    delivery: pct(n("DELIVERED"), outcome),
    returns: pct(n("RETURNED"), outcome),
  };
}

export const daysAgo = (days: number, now = Date.now()) => new Date(now - days * 24 * 3600 * 1000);

/** Fills missing days with 0 so the chart has one bar per day. Dates are YYYY-MM-DD. */
export function fillDays(rows: { day: string; count: number }[], lastDay: string, days: number) {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const end = new Date(`${lastDay}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (days - 1 - i));
    const day = d.toISOString().slice(0, 10);
    return { day, count: byDay.get(day) ?? 0 };
  });
}
