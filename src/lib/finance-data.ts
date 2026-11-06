import "server-only";
import { db } from "./db";
import { computeCapital, computeProfit, expectedFromCarrier } from "./finance";
import { effectiveCost } from "./stock";

const orderFields = { total: true, carrierFee: true, items: { select: { unitCost: true, quantity: true } } } as const;

/** Profit of a period: a sale counts on the day it was delivered, a return on the day it came back. */
export async function loadProfit(since: Date, until = new Date()) {
  const range = { gte: since, lte: until };
  const [delivered, returned, expenses, adjustments, settings] = await Promise.all([
    db.order.findMany({ where: { status: "DELIVERED", deliveredAt: range }, select: orderFields }),
    db.order.findMany({ where: { status: "RETURNED", returnedAt: range }, select: orderFields }),
    db.expense.findMany({ where: { spentOn: range }, select: { scope: true, category: true, amount: true } }),
    db.stockMovement.findMany({ where: { reason: "ADJUSTMENT", createdAt: range }, select: { delta: true, unitCost: true } }),
    db.settings.findUnique({ where: { id: 1 }, select: { defaultDeliveryCost: true, defaultReturnCost: true } }),
  ]);
  return computeProfit({
    delivered,
    returned,
    expenses,
    stockAdjustmentValue: adjustments.reduce((s, m) => s + m.delta * (m.unitCost ?? 0), 0),
    defaultDeliveryCost: settings?.defaultDeliveryCost ?? 0,
    defaultReturnCost: settings?.defaultReturnCost ?? 0,
  });
}

/** Where all the money is today, since the very beginning. */
export async function loadCapital() {
  const [capital, expenses, movements, cod, variants, inTransit, owed, settings] = await Promise.all([
    db.capitalEntry.groupBy({ by: ["type"], _sum: { amount: true } }),
    db.expense.groupBy({ by: ["scope"], _sum: { amount: true } }),
    // Products hidden from the shop (the old demo catalogue) stay out of the money; a deleted product's moves stay in.
    db.stockMovement.findMany({
      where: { reason: { in: ["OPENING", "STOCK_IN"] }, OR: [{ productId: null }, { product: { isActive: true } }] },
      select: { reason: true, delta: true, unitCost: true },
    }),
    db.order.aggregate({ _sum: { codReceivedAmount: true } }),
    db.variant.findMany({ where: { stock: { gt: 0 } }, select: { stock: true, costPrice: true, product: { select: { costPrice: true, isActive: true } } } }),
    db.orderItem.findMany({ where: { order: { status: { in: ["CONFIRMED", "SHIPPING"] }, stockDeducted: true } }, select: { unitCost: true, quantity: true } }),
    db.order.findMany({ where: { status: "DELIVERED", codReceivedAt: null }, select: { total: true, carrierFee: true } }),
    db.settings.findUnique({ where: { id: 1 }, select: { defaultDeliveryCost: true } }),
  ]);

  const sum = (type: string) => capital.find((c) => c.type === type)?._sum.amount ?? 0;
  const spent = (scope: string) => expenses.find((e) => e.scope === scope)?._sum.amount ?? 0;
  let openingStockValue = 0;
  let purchases = 0;
  let movesWithoutCost = 0;
  for (const m of movements) {
    if (m.delta > 0 && m.unitCost === null) movesWithoutCost += m.delta;
    const value = m.delta * (m.unitCost ?? 0);
    if (m.reason === "OPENING") openingStockValue += value;
    else purchases += value;
  }
  let inventoryValue = 0;
  let unitsWithoutCost = 0;
  let hiddenUnits = 0;
  for (const v of variants) {
    if (!v.product.isActive) {
      hiddenUnits += v.stock;
      continue;
    }
    const cost = effectiveCost(v.costPrice, v.product.costPrice);
    if (cost === null) unitsWithoutCost += v.stock;
    else inventoryValue += cost * v.stock;
  }
  const goodsInTransit = inTransit.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0);
  const owedByCarrier = owed.reduce((s, o) => s + expectedFromCarrier(o.total, o.carrierFee, settings?.defaultDeliveryCost ?? 0), 0);

  const input = {
    injections: sum("INJECTION"),
    withdrawals: sum("WITHDRAWAL"),
    openingStockValue,
    purchases,
    codReceived: cod._sum.codReceivedAmount ?? 0,
    businessExpenses: spent("BUSINESS"),
    personalExpenses: spent("PERSONAL"),
    inventoryValue,
    goodsInTransit,
    owedByCarrier,
  };
  return { ...input, ...computeCapital(input), gaps: { unitsWithoutCost, movesWithoutCost }, hiddenUnits };
}
