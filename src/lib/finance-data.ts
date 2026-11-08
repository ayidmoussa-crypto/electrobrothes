import "server-only";
import { db } from "./db";
import { computeCapital, computeProfit, expectedFromCarrier, profitTrend, trendBuckets } from "./finance";
import { effectiveCost } from "./stock";

/** The order fields lib/finance needs to know the carrier's cut. */
export const feeFields = { total: true, carrierFee: true, shippingFee: true, city: { select: { shippingFee: true } } } as const;

export const toFeeOrder = <T extends { carrierFee: number | null; shippingFee: number; total: number; city: { shippingFee: number } }>(o: T) => ({
  ...o,
  cityFee: o.city.shippingFee,
});

const orderFields = { ...feeFields, items: { select: { unitCost: true, quantity: true } } } as const;

/** Profit of a period: a sale counts on the day it was delivered, a return on the day it came back. */
export async function loadProfit(since: Date, until = new Date()) {
  const range = { gte: since, lte: until };
  const [delivered, returned, expenses, adjustments] = await Promise.all([
    db.order.findMany({ where: { status: "DELIVERED", deliveredAt: range }, select: orderFields }),
    db.order.findMany({ where: { status: "RETURNED", returnedAt: range }, select: orderFields }),
    db.expense.findMany({ where: { spentOn: range }, select: { scope: true, category: true, amount: true } }),
    db.stockMovement.findMany({ where: { reason: "ADJUSTMENT", createdAt: range }, select: { delta: true, unitCost: true } }),
  ]);
  return computeProfit({
    delivered: delivered.map(toFeeOrder),
    returned: returned.map(toFeeOrder),
    expenses,
    stockAdjustmentValue: adjustments.reduce((s, m) => s + m.delta * (m.unitCost ?? 0), 0),
  });
}

/**
 * Everything the finance page shows about one period: the profit, how it moved slot by slot, where the
 * sales came from, and the same profit for the period just before, to compare with.
 */
export async function loadPeriod(days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * 24 * 3600 * 1000);
  const range = { gte: since, lte: now };
  const dated = { ...orderFields, channel: true, deliveredAt: true, returnedAt: true } as const;
  const [delivered, returned, expenses, adjustments, before] = await Promise.all([
    db.order.findMany({ where: { status: "DELIVERED", deliveredAt: range }, select: dated }),
    db.order.findMany({ where: { status: "RETURNED", returnedAt: range }, select: dated }),
    db.expense.findMany({ where: { spentOn: range }, select: { scope: true, category: true, amount: true, spentOn: true } }),
    db.stockMovement.findMany({ where: { reason: "ADJUSTMENT", createdAt: range }, select: { delta: true, unitCost: true, createdAt: true } }),
    loadProfit(new Date(since.getTime() - days * 24 * 3600 * 1000), since),
  ]);
  const d = delivered.map((o) => ({ ...toFeeOrder(o), at: o.deliveredAt ?? now }));
  const r = returned.map((o) => ({ ...toFeeOrder(o), at: o.returnedAt ?? now }));
  const e = expenses.map((x) => ({ ...x, at: x.spentOn }));
  const a = adjustments.map((m) => ({ value: m.delta * (m.unitCost ?? 0), at: m.createdAt }));

  const profit = computeProfit({ delivered: d, returned: r, expenses: e, stockAdjustmentValue: a.reduce((s, x) => s + x.value, 0) });
  const trend = profitTrend(trendBuckets(days, now), { delivered: d, returned: r, expenses: e, adjustments: a });
  // Sales by where the buyer came from; "" = an order from before tracking started.
  const byChannel = new Map<string, { revenue: number; orders: number }>();
  for (const o of delivered) {
    const k = o.channel ?? "";
    const c = byChannel.get(k) ?? { revenue: 0, orders: 0 };
    byChannel.set(k, { revenue: c.revenue + o.total, orders: c.orders + 1 });
  }
  const sources = [...byChannel].map(([channel, c]) => ({ channel, ...c })).sort((x, y) => y.revenue - x.revenue);
  return { profit, trend, sources, before };
}

/** Where all the money is today, since the very beginning. */
export async function loadCapital() {
  const [capital, expenses, movements, cod, variants, inTransit, owed] = await Promise.all([
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
    db.order.findMany({ where: { status: "DELIVERED", codReceivedAt: null }, select: feeFields }),
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
  const owedByCarrier = owed.reduce((s, o) => s + expectedFromCarrier(toFeeOrder(o)), 0);

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
