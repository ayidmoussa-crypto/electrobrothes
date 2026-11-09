import assert from "node:assert/strict";
import { test } from "node:test";
import { changePct, computeCapital, computeProfit, expectedFromCarrier, profitTrend, trendBuckets, type ProfitInput } from "./finance";

const base: ProfitInput = { delivered: [], returned: [], expenses: [], stockAdjustmentValue: 0 };
// An order under the free-delivery threshold (customer paid 30) and one above it (shop pays the city's 30).
const paid = { carrierFee: null, shippingFee: 30, cityFee: 30 };
const free = { carrierFee: null, shippingFee: 0, cityFee: 30 };

test("no activity gives zeros and no rates", () => {
  const p = computeProfit(base);
  assert.equal(p.netProfit, 0);
  assert.equal(p.margin, null);
  assert.equal(p.perOrder, null);
});

test("net profit = revenue − goods − delivery − returns − expenses − stock lost", () => {
  const p = computeProfit({
    ...base,
    delivered: [
      { ...paid, total: 300, carrierFee: 25, items: [{ unitCost: 100, quantity: 2 }] },
      { ...free, total: 150, items: [{ unitCost: 50, quantity: 1 }] },
    ],
    returned: [{ ...paid, total: 200, carrierFee: 20, items: [{ unitCost: 90, quantity: 1 }] }],
    expenses: [
      { scope: "BUSINESS", category: "ADS", amount: 40 },
      { scope: "PERSONAL", category: "LIVING", amount: 500 },
    ],
    stockAdjustmentValue: -10,
  });
  assert.equal(p.revenue, 450);
  assert.equal(p.cogs, 250);
  assert.equal(p.deliveryCost, 55); // 25 typed on the order + 30 city price
  assert.equal(p.grossProfit, 145);
  assert.equal(p.returnsCost, 20);
  assert.equal(p.businessExpenses, 40);
  assert.equal(p.stockLoss, 10);
  assert.equal(p.netProfit, 75);
  assert.equal(p.margin, 17);
  assert.equal(p.perOrder, 25);
  assert.equal(p.costPerDelivered, 20);
});

test("personal spending never changes the shop's profit, only what is left after it", () => {
  const p = computeProfit({ ...base, expenses: [{ scope: "PERSONAL", category: "LOSS", amount: 1000 }] });
  assert.equal(p.netProfit, 0);
  assert.equal(p.personalExpenses, 1000);
  assert.equal(p.afterPersonal, -1000);
});

test("a returned order's goods are not a cost: they went back to stock", () => {
  const p = computeProfit({ ...base, returned: [{ ...paid, total: 500, carrierFee: 35, items: [{ unitCost: 400, quantity: 1 }] }] });
  assert.equal(p.cogs, 0);
  assert.equal(p.netProfit, -35);
});

test("a refused parcel costs nothing unless a fee was typed on it", () => {
  const p = computeProfit({ ...base, returned: [{ ...free, total: 600, items: [] }, { ...paid, total: 200, items: [] }] });
  assert.equal(p.returnsCost, 0);
  assert.equal(p.netProfit, 0);
});

test("the carrier takes the city price: paid by the customer under the threshold, by the shop above it", () => {
  // Under 500: 200 goods + 30 delivery collected, the carrier keeps 30, the shop gets its 200.
  assert.equal(expectedFromCarrier({ ...paid, total: 230 }), 200);
  // Above 500: 600 collected, the carrier keeps the city's 30, the shop gets 570.
  assert.equal(expectedFromCarrier({ ...free, total: 600 }), 570);
  // A fee typed on the order wins.
  assert.equal(expectedFromCarrier({ ...free, total: 600, carrierFee: 25 }), 575);
  // Paid before shipping: nothing collected, the carrier still takes its fee.
  assert.equal(expectedFromCarrier({ ...free, total: 600, prepaid: true }), -30);
});

test("money paid before shipping is cash in hand", () => {
  const zero = { injections: 0, withdrawals: 0, openingStockValue: 0, purchases: 0, codReceived: 0, businessExpenses: 0, personalExpenses: 0, inventoryValue: 0, goodsInTransit: 0, owedByCarrier: 0 };
  assert.equal(computeCapital({ ...zero, prepaidReceived: 900 }).cash, 900);
});

test("unknown costs are reported, never silently treated as free", () => {
  const p = computeProfit({
    ...base,
    delivered: [{ total: 100, carrierFee: null, shippingFee: 0, cityFee: 0, items: [{ unitCost: null, quantity: 3 }] }],
  });
  assert.deepEqual(p.gaps, { unitsWithoutCost: 3, deliveredWithoutFee: 1 });
});

test("a carrier fee of zero on the order (handed over by the owner) wins and is not a gap", () => {
  const p = computeProfit({ ...base, delivered: [{ ...free, total: 100, carrierFee: 0, items: [] }] });
  assert.equal(p.deliveryCost, 0);
  assert.equal(p.gaps.deliveredWithoutFee, 0);
});

test("chart slots: days, then weeks, then months, oldest first", () => {
  const now = new Date("2026-11-08T15:00:00Z");
  const week = trendBuckets(7, now);
  assert.equal(week.count, 7);
  assert.equal(week.labelOf(6), "08/11");
  assert.equal(week.labelOf(0), "02/11");
  assert.equal(week.indexOf(new Date("2026-11-08T00:10:00Z")), 6);
  assert.equal(week.indexOf(new Date("2026-11-01T23:00:00Z")), -1);

  const quarter = trendBuckets(90, now);
  assert.equal(quarter.count, 13);
  assert.equal(quarter.indexOf(new Date("2026-11-02T10:00:00Z")), 12);
  assert.equal(quarter.indexOf(new Date("2026-11-01T10:00:00Z")), 11);
  assert.equal(quarter.labelOf(12), "02/11");

  const year = trendBuckets(365, now);
  assert.equal(year.count, 13);
  assert.equal(year.labelOf(12), "11/26");
  assert.equal(year.labelOf(0), "11/25");
  assert.equal(year.indexOf(new Date("2026-10-31T10:00:00Z")), 11);
});

test("the slots add up to the whole period", () => {
  const now = new Date("2026-11-08T15:00:00Z");
  const delivered = [
    { ...free, total: 600, at: new Date("2026-11-08T09:00:00Z"), items: [{ unitCost: 400, quantity: 1 }] },
    { ...paid, total: 230, at: new Date("2026-11-06T09:00:00Z"), items: [{ unitCost: 100, quantity: 1 }] },
  ];
  const expenses = [{ scope: "BUSINESS" as const, category: "ADS", amount: 50, at: new Date("2026-11-06T12:00:00Z") }];
  const t = profitTrend(trendBuckets(7, now), { delivered, returned: [], expenses, adjustments: [] });
  assert.deepEqual(t.map((s) => s.revenue), [0, 0, 0, 0, 230, 0, 600]);
  assert.deepEqual(t.map((s) => s.net), [0, 0, 0, 0, 50, 0, 170]);
  assert.equal(t.reduce((s, x) => s + x.net, 0), computeProfit({ ...base, delivered, expenses }).netProfit);
});

test("change from the previous period", () => {
  assert.equal(changePct(1180, 1000), 18);
  assert.equal(changePct(500, 1000), -50);
  assert.equal(changePct(100, 0), null);
});

test("hand corrections that add stock are not a profit", () => {
  assert.equal(computeProfit({ ...base, stockAdjustmentValue: 300 }).netProfit, 0);
});

test("expenses are grouped by scope and category", () => {
  const p = computeProfit({
    ...base,
    expenses: [
      { scope: "BUSINESS", category: "ADS", amount: 10 },
      { scope: "BUSINESS", category: "ADS", amount: 5 },
      { scope: "PERSONAL", category: "OTHER", amount: 7 },
      { scope: "BUSINESS", category: "OTHER", amount: 3 },
    ],
  });
  assert.deepEqual(p.expensesByCategory, [
    { scope: "BUSINESS", category: "ADS", amount: 15 },
    { scope: "PERSONAL", category: "OTHER", amount: 7 },
    { scope: "BUSINESS", category: "OTHER", amount: 3 },
  ]);
});

test("capital: cash, position and the result of the whole business", () => {
  const c = computeCapital({
    injections: 10000,
    withdrawals: 1000,
    openingStockValue: 2000,
    purchases: 4000,
    codReceived: 3000,
    businessExpenses: 500,
    personalExpenses: 700,
    inventoryValue: 5000,
    goodsInTransit: 300,
    owedByCarrier: 200,
  });
  assert.equal(c.cash, 6800);
  assert.equal(c.position, 12300);
  assert.equal(c.invested, 11000);
  assert.equal(c.result, 1300);
  assert.equal(c.resultPct, 12);
});

test("capital with nothing invested has no percentage", () => {
  const zero = { injections: 0, withdrawals: 0, openingStockValue: 0, purchases: 0, codReceived: 0, businessExpenses: 0, personalExpenses: 0, inventoryValue: 0, goodsInTransit: 0, owedByCarrier: 0 };
  assert.equal(computeCapital(zero).resultPct, null);
});
