import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { agentBalance, type Pay } from "./staff-rules";

/** Reads every agent's earned and settled orders (or one agent's) and returns how to get a balance from them. */
export async function loadBalances(client: Prisma.TransactionClient = db, agentId?: string) {
  const who = agentId ? { handledById: agentId } : { handledBy: { role: "AGENT" as const } };
  const [confirmed, delivered, paid] = await Promise.all([
    client.order.groupBy({ by: ["handledById"], where: { ...who, handledAs: "CONFIRMED" }, _count: { _all: true } }),
    client.order.groupBy({ by: ["handledById"], where: { ...who, handledAs: "CONFIRMED", status: "DELIVERED" }, _count: { _all: true } }),
    client.agentPayment.groupBy({ by: ["agentId"], where: agentId ? { agentId } : {}, _sum: { confirmedCount: true, deliveredCount: true } }),
  ]);
  return (agent: Pay & { id: string }) => {
    const settled = paid.find((p) => p.agentId === agent.id)?._sum;
    return agentBalance(
      {
        confirmed: confirmed.find((c) => c.handledById === agent.id)?._count._all ?? 0,
        delivered: delivered.find((c) => c.handledById === agent.id)?._count._all ?? 0,
      },
      { confirmed: settled?.confirmedCount ?? 0, delivered: settled?.deliveredCount ?? 0 },
      agent,
    );
  };
}

/** Latest payments, newest first. */
export const recentPayments = (agentId?: string) =>
  db.agentPayment.findMany({
    where: agentId ? { agentId } : {},
    orderBy: { paidAt: "desc" },
    take: 50,
    select: { id: true, agentId: true, amount: true, paidAt: true },
  });

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
