import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUSES, type OrderStatus } from "./order-rules";
import { normalizeMoroccanPhone } from "./phone";
import { moroccanDate } from "./time";

/** `view: "board"` shows the orders as columns by status (desktop) instead of the table. */
export type OrderFilters = { status?: OrderStatus; q?: string; risky?: boolean; from?: string; to?: string; page: number; view?: "board" };

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function parseOrderFilters(raw: Raw): OrderFilters {
  const status = one(raw.status) as OrderStatus | undefined;
  return {
    status: status && ORDER_STATUSES.includes(status) ? status : undefined,
    q: one(raw.q)?.slice(0, 80),
    risky: raw.risky === "1",
    from: isoDate(one(raw.from)),
    to: isoDate(one(raw.to)),
    page: Math.max(1, Number(one(raw.page)) || 1),
    view: one(raw.view) === "board" ? "board" : undefined,
  };
}

/** Same filters for the orders table and the CSV export. */
export function orderWhere(f: OrderFilters): Prisma.OrderWhereInput {
  const phone = f.q ? normalizeMoroccanPhone(f.q) : null;
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.risky ? { riskScore: { gte: 30 } } : {}),
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
  if (f.risky) s.set("risky", "1");
  if (f.from) s.set("from", f.from);
  if (f.to) s.set("to", f.to);
  if (f.page && f.page > 1) s.set("page", String(f.page));
  if (f.view) s.set("view", f.view);
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}
