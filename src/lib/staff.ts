import "server-only";
import { db } from "./db";

/** The new orders an agent answered in [start, end), newest first. */
export const handledOrders = (userId: string, start: Date, end: Date) =>
  db.order.findMany({
    where: { handledById: userId, handledAt: { gte: start, lt: end } },
    orderBy: { handledAt: "desc" },
    select: { id: true, number: true, customerName: true, cityName: true, total: true, status: true, handledAs: true, handledAt: true },
  });

/** Every agent with what they answered in [start, end): one query for the team page. */
export async function teamMonth(start: Date, end: Date) {
  const [agents, rows] = await Promise.all([
    db.adminUser.findMany({
      where: { role: "AGENT" },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, isActive: true, payPerConfirmed: true, payPerDelivered: true, lastLoginAt: true },
    }),
    db.order.findMany({
      where: { handledBy: { role: "AGENT" }, handledAt: { gte: start, lt: end } },
      select: { handledById: true, handledAs: true, status: true },
    }),
  ]);
  return agents.map((a) => ({ ...a, rows: rows.filter((r) => r.handledById === a.id) }));
}
