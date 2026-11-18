import "server-only";
import { SHOP_CHANNEL } from "./attribution";
import { db } from "./db";
import { compareSales } from "./sales-compare";
import { computeCapital, computeProfit, expectedFromCarrier, goodsOnTheRoad, profitTrend, trendBuckets } from "./finance";
import type { Period } from "./period";
import { effectiveCost } from "./stock";

/** The order fields lib/finance needs to know the carrier's cut. */
export const feeFields = { total: true, carrierFee: true, shippingFee: true, prepaidAt: true, city: { select: { shippingFee: true } } } as const;

export const toFeeOrder = <T extends { carrierFee: number | null; shippingFee: number; total: number; prepaidAt: Date | null; city: { shippingFee: number } }>(o: T) => ({
  ...o,
  cityFee: o.city.shippingFee,
  prepaid: o.prepaidAt !== null,
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
export async function loadPeriod({ from: since, until: now, days, prevFrom }: Pick<Period, "from" | "until" | "days" | "prevFrom">) {
  const range = { gte: since, lte: now };
  const dated = { ...orderFields, channel: true, deliveredAt: true, returnedAt: true } as const;
  const [delivered, returned, expenses, adjustments, before] = await Promise.all([
    db.order.findMany({ where: { status: "DELIVERED", deliveredAt: range }, select: dated }),
    db.order.findMany({ where: { status: "RETURNED", returnedAt: range }, select: dated }),
    db.expense.findMany({ where: { spentOn: range }, select: { scope: true, category: true, amount: true, spentOn: true } }),
    db.stockMovement.findMany({ where: { reason: "ADJUSTMENT", createdAt: range }, select: { delta: true, unitCost: true, createdAt: true } }),
    loadProfit(prevFrom, new Date(since.getTime() - 1)),
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

/** Online orders against shop sales over a period, with the latest of each to act on. */
export async function loadSalesComparison({ from, until }: Pick<Period, "from" | "until">) {
  const range = { gte: from, lte: until };
  const select = { ...orderFields, channel: true } as const;
  const row = { id: true, number: true, customerName: true, total: true, status: true, createdAt: true } as const;
  const [delivered, returned, latestShop, latestOnline] = await Promise.all([
    db.order.findMany({ where: { status: "DELIVERED", deliveredAt: range }, select }),
    db.order.findMany({ where: { status: "RETURNED", returnedAt: range }, select }),
    db.order.findMany({ where: { channel: SHOP_CHANNEL }, orderBy: { createdAt: "desc" }, take: 6, select: row }),
    // Orders from before tracking have no channel: `not` alone would skip them.
    db.order.findMany({ where: { OR: [{ channel: null }, { channel: { not: SHOP_CHANNEL } }] }, orderBy: { createdAt: "desc" }, take: 6, select: row }),
  ]);
  return { ...compareSales(delivered.map(toFeeOrder), returned.map(toFeeOrder)), latestShop, latestOnline };
}

/** Where all the money is today, since the very beginning. */
export async function loadCapital() {
  const [capital, expenses, movements, cod, variants, inTransit, owed, prepaid] = await Promise.all([
    db.capitalEntry.groupBy({ by: ["type"], _sum: { amount: true } }),
    db.expense.groupBy({ by: ["scope"], _sum: { amount: true } }),
    // Products hidden from the shop (the old demo catalogue) stay out of the money; a deleted product's moves stay in.
    db.stockMovement.findMany({
      where: { reason: { in: ["OPENING", "STOCK_IN"] }, OR: [{ productId: null }, { product: { isActive: true } }] },
      select: { reason: true, delta: true, unitCost: true },
    }),
    db.order.aggregate({ _sum: { codReceivedAmount: true } }),
    db.variant.findMany({ where: { stock: { gt: 0 } }, select: { stock: true, costPrice: true, product: { select: { costPrice: true, isActive: true } } } }),
    db.orderItem.findMany({ where: { order: { status: { in: ["CONFIRMED", "SHIPPING", "RETURNING"] }, stockDeducted: true } }, select: { unitCost: true, quantity: true, order: { select: { status: true } } } }),
    db.order.findMany({ where: { status: "DELIVERED", codReceivedAt: null }, select: feeFields }),
    // A cancelled or refused prepaid order (returning or returned) is taken as refunded.
    db.order.aggregate({ where: { prepaidAt: { not: null }, status: { in: ["NEW", "CONFIRMED", "SHIPPING", "DELIVERED"] } }, _sum: { total: true } }),
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
  const { total: goodsInTransit, returning: goodsReturning } = goodsOnTheRoad(inTransit.map((i) => ({ unitCost: i.unitCost, quantity: i.quantity, status: i.order.status })));
  const owedByCarrier = owed.reduce((s, o) => s + expectedFromCarrier(toFeeOrder(o)), 0);

  const input = {
    injections: sum("INJECTION"),
    withdrawals: sum("WITHDRAWAL"),
    openingStockValue,
    purchases,
    codReceived: cod._sum.codReceivedAmount ?? 0,
    prepaidReceived: prepaid._sum.total ?? 0,
    businessExpenses: spent("BUSINESS"),
    personalExpenses: spent("PERSONAL"),
    inventoryValue,
    goodsInTransit,
    owedByCarrier,
  };
  return { ...input, ...computeCapital(input), goodsReturning, gaps: { unitsWithoutCost, movesWithoutCost }, hiddenUnits };
}
