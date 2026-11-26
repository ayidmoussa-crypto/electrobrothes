import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUSES, type OrderStatus } from "./order-rules";
import { normalizeMoroccanPhone } from "./phone";
import { reviewAskSince } from "./reviews/ask";
import { moroccanDate } from "./time";

/**
 * `view: "board"` shows the orders as columns by status (desktop) instead of the table. `reviewAsk`: delivered orders
 * still waiting for their review request (lib/reviews/ask.ts), oldest delivery first.
 */
export type OrderFilters = { status?: OrderStatus; q?: string; city?: string; risky?: boolean; reviewAsk?: boolean; from?: string; to?: string; page: number; view?: "board" };

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function parseOrderFilters(raw: Raw): OrderFilters {
  const status = one(raw.status) as OrderStatus | undefined;
  return {
    status: status && ORDER_STATUSES.includes(status) ? status : undefined,
    q: one(raw.q)?.slice(0, 80),
    // A city's id: anything longer than an id is ignored.
    city: one(raw.city)?.slice(0, 40),
    risky: raw.risky === "1",
    reviewAsk: raw.review === "ask",
    from: isoDate(one(raw.from)),
    to: isoDate(one(raw.to)),
    page: Math.max(1, Number(one(raw.page)) || 1),
    view: one(raw.view) === "board" ? "board" : undefined,
  };
}

/** The database side of awaitsReviewAsk (lib/reviews/ask.ts): the bell's count and the orders filter use it. */
export const awaitingReviewAskWhere = (now: Date): Prisma.OrderWhereInput => ({
  status: "DELIVERED",
  reviewAskedAt: null,
  deliveredAt: { gte: reviewAskSince(now) },
  items: { none: { review: { isNot: null } } },
});

/** Same filters for the orders table and the CSV export. */
export function orderWhere(f: OrderFilters, now = new Date()): Prisma.OrderWhereInput {
  const phone = f.q ? normalizeMoroccanPhone(f.q) : null;
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.city ? { cityId: f.city } : {}),
    ...(f.risky ? { riskScore: { gte: 30 } } : {}),
    ...(f.reviewAsk ? awaitingReviewAskWhere(now) : {}),
    ...(f.from || f.to
      ? {
          createdAt: {
            ...(f.from ? { gte: moroccanDate(f.from) } : {}),
            ...(f.to ? { lte: moroccanDate(`${f.to}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(f.q
      ? {
          OR: [
            { number: { contains: f.q.toUpperCase() } },
            { trackingNumber: { contains: f.q, mode: "insensitive" } },
            { customerName: { contains: f.q, mode: "insensitive" } },
            ...(phone ? [{ phone }] : []),
          ],
        }
      : {}),
  };
}

/** "منذ 6 ساعات" on a board card: minutes, hours, days, then the date after a week. */
export function ageLabel(d: Date, now: Date, locale: string, timeZone: string) {
  const ago = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const minutes = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 60) return ago.format(-Math.max(1, minutes), "minute");
  if (minutes < 24 * 60) return ago.format(-Math.round(minutes / 60), "hour");
  if (minutes < 7 * 24 * 60) return ago.format(-Math.round(minutes / 1440), "day");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone }).format(d);
}

export function filterQuery(f: Partial<OrderFilters>) {
  const s = new URLSearchParams();
  if (f.status) s.set("status", f.status);
  if (f.q) s.set("q", f.q);
  if (f.city) s.set("city", f.city);
  if (f.risky) s.set("risky", "1");
  if (f.reviewAsk) s.set("review", "ask");
  if (f.from) s.set("from", f.from);
  if (f.to) s.set("to", f.to);
  if (f.page && f.page > 1) s.set("page", String(f.page));
  if (f.view) s.set("view", f.view);
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}
