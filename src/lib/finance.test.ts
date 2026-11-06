import assert from "node:assert/strict";
import { test } from "node:test";
import { computeCapital, computeProfit, expectedFromCarrier, type ProfitInput } from "./finance";

const base: ProfitInput = { delivered: [], returned: [], expenses: [], stockAdjustmentValue: 0, defaultDeliveryCost: 30, defaultReturnCost: 20 };

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
      { total: 300, carrierFee: 25, items: [{ unitCost: 100, quantity: 2 }] },
      { total: 150, carrierFee: null, items: [{ unitCost: 50, quantity: 1 }] },
    ],
    returned: [{ total: 200, carrierFee: null, items: [{ unitCost: 90, quantity: 1 }] }],
    expenses: [
      { scope: "BUSINESS", category: "ADS", amount: 40 },
      { scope: "PERSONAL", category: "LIVING", amount: 500 },
    ],
    stockAdjustmentValue: -10,
  });
  assert.equal(p.revenue, 450);
  assert.equal(p.cogs, 250);
  assert.equal(p.deliveryCost, 55); // 25 own fee + 30 default
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
  const p = computeProfit({ ...base, returned: [{ total: 500, carrierFee: 35, items: [{ unitCost: 400, quantity: 1 }] }] });
  assert.equal(p.cogs, 0);
  assert.equal(p.netProfit, -35);
});

test("unknown costs are reported, never silently treated as free", () => {
  const p = computeProfit({
    ...base,
    defaultDeliveryCost: 0,
    defaultReturnCost: 0,
    delivered: [{ total: 100, carrierFee: null, items: [{ unitCost: null, quantity: 3 }] }],
    returned: [{ total: 100, carrierFee: null, items: [] }],
  });
  assert.deepEqual(p.gaps, { unitsWithoutCost: 3, deliveredWithoutFee: 1, returnedWithoutFee: 1 });
});

test("a carrier fee of zero on the order wins over the default but is flagged as unknown", () => {
  const p = computeProfit({ ...base, delivered: [{ total: 100, carrierFee: 0, items: [] }] });
  assert.equal(p.deliveryCost, 0);
  assert.equal(p.gaps.deliveredWithoutFee, 1);
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

test("expected from the carrier is the cash minus its fee", () => {
  assert.equal(expectedFromCarrier(300, 25, 30), 275);
  assert.equal(expectedFromCarrier(300, null, 30), 270);
});
