import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ADMIN_STATS_TAG } from "./admin-stats-tag";
import { db } from "./db";
import { feeFields, loadCapital, loadPeriod, loadSalesComparison } from "./finance-data";
import { loadVisitors } from "./visitors-data";

// The finance and sales pages' figures, cached like the dashboard's (lib/dashboard-data.ts): two minutes, expired at once by
// any order, stock or money change. Periods come in as plain numbers, the end set by resolveAdminPeriod.

export async function financePeriod(sinceMs: number, untilMs: number, days: number, prevFromMs: number) {
  "use cache";
  cacheLife({ stale: 0, revalidate: 120, expire: 600 });
  cacheTag(ADMIN_STATS_TAG);
  return loadPeriod({ from: new Date(sinceMs), until: new Date(untilMs), days, prevFrom: new Date(prevFromMs) });
}

/** Where all the money is, since the very beginning: the same whatever the period. */
export async function financeCapital() {
  "use cache";
  cacheLife({ stale: 0, revalidate: 120, expire: 600 });
  cacheTag(ADMIN_STATS_TAG);
  return loadCapital();
}

/** The lists under the finance figures: what the carriers still owe, the latest expenses, capital moves and transfers. */
export async function financeLists() {
  "use cache";
  cacheLife({ stale: 0, revalidate: 120, expire: 600 });
  cacheTag(ADMIN_STATS_TAG);
  const [uncollected, expenses, capitalEntries, received] = await Promise.all([
    db.order.findMany({
      where: { status: "DELIVERED", codReceivedAt: null },
      orderBy: { deliveredAt: "asc" },
      take: 100,
      select: { id: true, number: true, customerName: true, deliveredAt: true, ...feeFields },
    }),
    db.expense.findMany({ orderBy: { spentOn: "desc" }, take: 40 }),
    db.capitalEntry.findMany({ orderBy: { occurredOn: "desc" }, take: 20 }),
    db.order.findMany({
      // Orders brought over from the old platform are settled with no amount: their cash is outside these books.
      where: { codReceivedAt: { not: null }, codReceivedAmount: { not: null } },
      orderBy: { codReceivedAt: "desc" },
      take: 8,
      select: { id: true, number: true, codReceivedAt: true, codReceivedAmount: true },
    }),
  ]);
  return { uncollected, expenses, capitalEntries, received };
}

export async function salesComparison(sinceMs: number, untilMs: number) {
  "use cache";
  cacheLife({ stale: 0, revalidate: 120, expire: 600 });
  cacheTag(ADMIN_STATS_TAG);
  return loadSalesComparison({ from: new Date(sinceMs), until: new Date(untilMs) });
}

/** The visitors page: its dozen queries run once a minute. New visits do not expire it (they never stop), orders do. */
export async function visitorsStats(sinceMs: number, untilMs: number) {
  "use cache";
  cacheLife({ stale: 0, revalidate: 120, expire: 600 });
  cacheTag(ADMIN_STATS_TAG);
  return loadVisitors({ from: new Date(sinceMs), until: new Date(untilMs) });
}
