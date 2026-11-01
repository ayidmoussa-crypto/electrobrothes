import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUSES, type OrderStatus } from "./order-rules";
import { normalizeMoroccanPhone } from "./phone";

export type OrderFilters = { status?: OrderStatus; q?: string; risky?: boolean; from?: string; to?: string; page: number };

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
            ...(f.from ? { gte: new Date(`${f.from}T00:00:00+01:00`) } : {}),
            ...(f.to ? { lte: new Date(`${f.to}T23:59:59+01:00`) } : {}),
          },
        }
      : {}),
    ...(f.q
      ? {
          OR: [
            { number: { contains: f.q.toUpperCase() } },
            { customerName: { contains: f.q, mode: "insensitive" } },
            ...(phone ? [{ phone }] : []),
          ],
        }
      : {}),
  };
}

export function filterQuery(f: Partial<OrderFilters>) {
  const s = new URLSearchParams();
  if (f.status) s.set("status", f.status);
  if (f.q) s.set("q", f.q);
  if (f.risky) s.set("risky", "1");
  if (f.from) s.set("from", f.from);
  if (f.to) s.set("to", f.to);
  if (f.page && f.page > 1) s.set("page", String(f.page));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}
