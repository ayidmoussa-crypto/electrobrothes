import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import type { Period } from "./period";
import { TIME_ZONE } from "./time";
import { VISIT_RETENTION_DAYS, type FunnelCounts } from "./visitors";

const n = (v: unknown) => Number(v ?? 0);

/** Everything the visitors page shows for one period (capped to the 90 days events are kept). */
export async function loadVisitors(period: Pick<Period, "from" | "until">) {
  const oldest = new Date(Date.now() - VISIT_RETENTION_DAYS * 86_400_000);
  const from = period.from < oldest ? oldest : period.from;
  const until = period.until;
  const inRange = Prisma.sql`"createdAt" >= ${from} AND "createdAt" <= ${until}`;

  const [totals, steps, after, abandoned, abandonedProducts, sources, cities, devices, products, buyers, searches, empty, pages, daily, firstEvent] = await Promise.all([
    db.$queryRaw<{ visitors: bigint; sessions: bigint; views: bigint; fresh: bigint; buyers: bigint }[]>`
      SELECT COUNT(DISTINCT "visitorId") AS visitors, COUNT(DISTINCT "sessionId") AS sessions,
             COUNT(*) FILTER (WHERE "type" = 'page_view') AS views,
             COUNT(DISTINCT "visitorId") FILTER (WHERE "isNew") AS fresh,
             COUNT(DISTINCT "visitorId") FILTER (WHERE "type" = 'order_placed') AS buyers
      FROM "VisitEvent" WHERE ${inRange}`,
    db.$queryRaw<{ type: string; sessions: bigint }[]>`
      SELECT "type", COUNT(DISTINCT "sessionId") AS sessions FROM "VisitEvent" WHERE ${inRange} GROUP BY "type"`,
    // What became of the orders placed during tracked visits.
    db.$queryRaw<{ confirmed: bigint; delivered: bigint }[]>`
      SELECT COUNT(DISTINCT e."sessionId") FILTER (WHERE o."status" IN ('CONFIRMED','SHIPPING','DELIVERED','RETURNING','RETURNED')) AS confirmed,
             COUNT(DISTINCT e."sessionId") FILTER (WHERE o."status" = 'DELIVERED') AS delivered
      FROM "VisitEvent" e JOIN "Order" o ON o."id" = e."orderId"
      WHERE e."type" = 'order_placed' AND e."createdAt" >= ${from} AND e."createdAt" <= ${until}`,
    // A visitor who added to the cart and never ordered in the period. Value: the lines they added.
    db.$queryRaw<{ visitors: bigint; value: bigint | null }[]>`
      WITH carts AS (SELECT "visitorId", SUM("value") AS value FROM "VisitEvent" WHERE ${inRange} AND "type" = 'add_to_cart' GROUP BY "visitorId"),
           ordered AS (SELECT DISTINCT "visitorId" FROM "VisitEvent" WHERE ${inRange} AND "type" = 'order_placed')
      SELECT COUNT(*) AS visitors, SUM(c.value) AS value FROM carts c WHERE c."visitorId" NOT IN (SELECT "visitorId" FROM ordered)`,
    db.$queryRaw<{ productId: string; visitors: bigint; value: bigint | null }[]>`
      WITH ordered AS (SELECT DISTINCT "visitorId" FROM "VisitEvent" WHERE ${inRange} AND "type" = 'order_placed')
      SELECT "productId", COUNT(DISTINCT "visitorId") AS visitors, SUM("value") AS value FROM "VisitEvent"
      WHERE ${inRange} AND "type" = 'add_to_cart' AND "productId" IS NOT NULL AND "visitorId" NOT IN (SELECT "visitorId" FROM ordered)
      GROUP BY "productId" ORDER BY visitors DESC LIMIT 8`,
    db.$queryRaw<{ channel: string | null; visitors: bigint; buyers: bigint }[]>`
      SELECT "channel", COUNT(DISTINCT "visitorId") AS visitors, COUNT(DISTINCT "visitorId") FILTER (WHERE "type" = 'order_placed') AS buyers
      FROM "VisitEvent" WHERE ${inRange} GROUP BY "channel" ORDER BY visitors DESC`,
    db.$queryRaw<{ city: string; visitors: bigint }[]>`
      SELECT "city", COUNT(DISTINCT "visitorId") AS visitors FROM "VisitEvent" WHERE ${inRange} AND "city" IS NOT NULL
      GROUP BY "city" ORDER BY visitors DESC LIMIT 10`,
    db.$queryRaw<{ device: string | null; visitors: bigint }[]>`
      SELECT "device", COUNT(DISTINCT "visitorId") AS visitors FROM "VisitEvent" WHERE ${inRange} GROUP BY "device" ORDER BY visitors DESC`,
    db.$queryRaw<{ productId: string; viewers: bigint; adders: bigint }[]>`
      SELECT "productId", COUNT(DISTINCT "visitorId") FILTER (WHERE "type" = 'product_view') AS viewers,
             COUNT(DISTINCT "visitorId") FILTER (WHERE "type" = 'add_to_cart') AS adders
      FROM "VisitEvent" WHERE ${inRange} AND "productId" IS NOT NULL
      GROUP BY "productId" ORDER BY viewers DESC LIMIT 15`,
    // Website orders per product in the period (all of them, tracked visit or not).
    db.$queryRaw<{ productId: string; orders: bigint }[]>`
      SELECT v."productId", COUNT(DISTINCT o."id") AS orders FROM "Order" o
      JOIN "OrderItem" i ON i."orderId" = o."id" JOIN "Variant" v ON v."id" = i."variantId"
      WHERE o."source" = 'WEBSITE' AND o."createdAt" >= ${from} AND o."createdAt" <= ${until}
      GROUP BY v."productId"`,
    db.$queryRaw<{ query: string; times: bigint; results: number }[]>`
      SELECT "query", COUNT(*) AS times, MAX("results") AS results FROM "VisitEvent"
      WHERE ${inRange} AND "type" = 'search' AND "query" IS NOT NULL GROUP BY "query" ORDER BY times DESC LIMIT 12`,
    db.$queryRaw<{ query: string; times: bigint }[]>`
      SELECT "query", COUNT(*) AS times FROM "VisitEvent"
      WHERE ${inRange} AND "type" = 'search' AND "results" = 0 AND "query" IS NOT NULL GROUP BY "query" ORDER BY times DESC LIMIT 12`,
    db.$queryRaw<{ path: string; views: bigint }[]>`
      SELECT "path", COUNT(*) AS views FROM "VisitEvent" WHERE ${inRange} AND "type" = 'page_view' AND "path" IS NOT NULL
      GROUP BY "path" ORDER BY views DESC LIMIT 10`,
    db.$queryRaw<{ day: string; visitors: bigint }[]>`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM-DD') AS day, COUNT(DISTINCT "visitorId") AS visitors
      FROM "VisitEvent" WHERE ${inRange} GROUP BY day ORDER BY day`,
    db.visitEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  const ids = [...new Set([...products.map((p) => p.productId), ...abandonedProducts.map((p) => p.productId)])];
  const names = new Map((await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, nameAr: true, nameEn: true, slug: true } })).map((p) => [p.id, p]));
  const orderCount = new Map(buyers.map((b) => [b.productId, n(b.orders)]));
  const step = (type: string) => n(steps.find((s) => s.type === type)?.sessions);
  const t = totals[0];

  const funnel: FunnelCounts = {
    sessions: n(t?.sessions),
    productViews: step("product_view"),
    carts: step("add_to_cart"),
    checkouts: step("checkout_start"),
    orders: step("order_placed"),
    confirmed: n(after[0]?.confirmed),
    delivered: n(after[0]?.delivered),
  };

  return {
    from,
    trackingSince: firstEvent?.createdAt ?? null,
    visitors: n(t?.visitors),
    sessions: n(t?.sessions),
    views: n(t?.views),
    newVisitors: n(t?.fresh),
    buyers: n(t?.buyers),
    funnel,
    abandoned: { visitors: n(abandoned[0]?.visitors), value: n(abandoned[0]?.value) },
    abandonedProducts: abandonedProducts.map((p) => ({ product: names.get(p.productId) ?? null, visitors: n(p.visitors), value: n(p.value) })),
    sources: sources.map((s) => ({ channel: s.channel, visitors: n(s.visitors), buyers: n(s.buyers) })),
    cities: cities.map((c) => ({ city: c.city, visitors: n(c.visitors) })),
    devices: devices.map((d) => ({ device: d.device ?? "desktop", visitors: n(d.visitors) })),
    products: products.map((p) => ({ product: names.get(p.productId) ?? null, viewers: n(p.viewers), adders: n(p.adders), orders: orderCount.get(p.productId) ?? 0 })),
    searches: searches.map((s) => ({ query: s.query, times: n(s.times), results: n(s.results) })),
    emptySearches: empty.map((s) => ({ query: s.query, times: n(s.times) })),
    pages: pages.map((p) => ({ path: p.path, views: n(p.views) })),
    daily: daily.map((d) => ({ day: d.day, visitors: n(d.visitors) })),
  };
}
