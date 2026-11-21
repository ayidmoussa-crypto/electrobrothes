import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { OrderStatus } from "@/lib/order-rules";
import { ADMIN_STATS_TAG } from "./admin-stats-tag";
import { db } from "./db";
import { loadProfit } from "./finance-data";
import { TIME_ZONE } from "./time";

const TZ = TIME_ZONE;

// The dashboard's figures. One cached function, so a repeat visit does not run its dozen queries again: it lives two
// minutes, and any order, stock or money change expires it at once (lib/admin-stats-tag.ts). The period comes in as plain
// numbers, with its end set by resolveAdminPeriod (lib/period.ts), so the same view is the same cache entry.

export const orderSelect = {
  id: true,
  number: true,
  status: true,
  customerName: true,
  cityName: true,
  total: true,
  _count: { select: { items: true } },
  items: {
    take: 1,
    select: {
      nameAr: true,
      nameEn: true,
      variant: {
        select: {
          product: {
            select: {
              images: {
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type ProductRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  image: string | null;
  price: number;
  delivered: number;
  returned: number;
  revenue: number;
  cost: number;
  missingCost: boolean;
};

export type DashboardOrder = Awaited<
  ReturnType<typeof dashboardData>
>["confirmed"][number];

export async function dashboardData(
  sinceMs: number,
  untilMs: number,
  prevFromMs: number,
) {
  "use cache";
  cacheLife({ stale: 0, revalidate: 120, expire: 600 });
  cacheTag(ADMIN_STATS_TAG);
  const since = new Date(sinceMs);
  const until = new Date(untilMs);
  const prevFrom = new Date(prevFromMs);
  const inPeriod = { gte: since, lte: until };

  // perDay covers the period before too, for the chart's dashed line.
  const [
    profit,
    byStatus,
    perDay,
    products,
    cities,
    todayByStatus,
    before,
    confirmedIds,
  ] = await Promise.all([
    loadProfit(since, until),
    db.order.groupBy({
      by: ["status"],
      where: { createdAt: inPeriod },
      _count: true,
    }),
    db.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM "Order" WHERE "createdAt" >= ${prevFrom} AND "createdAt" <= ${until} GROUP BY 1`,
    // Best products of the period: units delivered and sent back, money in, purchase cost of what was delivered.
    db.$queryRaw<ProductRow[]>`
      SELECT p."id", p."nameAr", p."nameEn",
        (SELECT pi."url" FROM "ProductImage" pi WHERE pi."productId" = p."id" ORDER BY pi."sortOrder" LIMIT 1) AS image,
        COALESCE(round(avg(oi."unitPrice") FILTER (WHERE o."status" = 'DELIVERED')), round(avg(oi."unitPrice")))::int AS price,
        COALESCE(sum(oi."quantity") FILTER (WHERE o."status" = 'DELIVERED'), 0)::int AS delivered,
        COALESCE(sum(oi."quantity") FILTER (WHERE o."status" IN ('RETURNING', 'RETURNED')), 0)::int AS returned,
        COALESCE(sum(oi."unitPrice" * oi."quantity") FILTER (WHERE o."status" = 'DELIVERED'), 0)::int AS revenue,
        COALESCE(sum(COALESCE(oi."unitCost", 0) * oi."quantity") FILTER (WHERE o."status" = 'DELIVERED'), 0)::int AS cost,
        COALESCE(bool_or(oi."unitCost" IS NULL) FILTER (WHERE o."status" = 'DELIVERED'), false) AS "missingCost"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Variant" v ON v."id" = oi."variantId"
      JOIN "Product" p ON p."id" = v."productId"
      WHERE o."createdAt" >= ${since} AND o."createdAt" <= ${until} AND o."status" IN ('DELIVERED', 'RETURNING', 'RETURNED')
      GROUP BY p."id"
      ORDER BY delivered DESC, revenue DESC
      LIMIT 5`,
    // Where the orders of the period go.
    db.$queryRaw<
      { id: string; nameAr: string; nameEn: string; count: number }[]
    >`
      SELECT c."id", c."nameAr", c."nameEn", count(*)::int AS count
      FROM "Order" o JOIN "City" c ON c."id" = o."cityId"
      WHERE o."createdAt" >= ${since} AND o."createdAt" <= ${until}
      GROUP BY c."id"
      ORDER BY count DESC
      LIMIT 8`,
    // Orders that came in today (shop's time zone), by where they stand now.
    db.$queryRaw<{ status: OrderStatus; count: number }[]>`
      SELECT "status", count(*)::int AS count FROM "Order"
      WHERE (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date
      GROUP BY 1`,
    // The same length of time just before, for the change badge.
    db.order.count({ where: { createdAt: { gte: prevFrom, lt: since } } }),
    // Confirmed today, whenever the order came in (a call today can confirm yesterday's order).
    db.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT "orderId" AS id FROM "OrderStatusLog"
      WHERE "toStatus" = 'CONFIRMED' AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date`,
  ]);
  // Newest confirmation first; an order cancelled since then no longer counts.
  const confirmed = await db.order.findMany({
    where: {
      id: { in: confirmedIds.map((r) => r.id) },
      status: { not: "CANCELLED" },
    },
    orderBy: { updatedAt: "desc" },
    select: orderSelect,
  });
  // Ready to ship = confirmed and still waiting for the carrier, whatever day they were confirmed.
  const [ready, readyTotal] = await Promise.all([
    db.order.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: orderSelect,
    }),
    db.order.count({ where: { status: "CONFIRMED" } }),
  ]);

  // The same products in the period just before: the trend arrow next to each name.
  const earlier = products.length
    ? await db.$queryRaw<{ id: string; delivered: number }[]>`
        SELECT v."productId" AS id, sum(oi."quantity")::int AS delivered
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" JOIN "Variant" v ON v."id" = oi."variantId"
        WHERE o."status" = 'DELIVERED' AND o."createdAt" >= ${prevFrom} AND o."createdAt" < ${since} AND v."productId" = ANY(${products.map((p) => p.id)})
        GROUP BY 1`
    : [];

  return {
    profit,
    byStatus,
    perDay,
    products,
    cities,
    todayByStatus,
    before,
    confirmed,
    ready,
    readyTotal,
    earlier,
  };
}
