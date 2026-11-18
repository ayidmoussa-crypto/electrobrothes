import assert from "node:assert/strict";
import { test } from "node:test";
import { SHOP_CHANNEL } from "./attribution";
import { compareSales, type CompareOrder } from "./sales-compare";

const order = (o: Partial<CompareOrder>): CompareOrder => ({
  channel: "DIRECT",
  total: 500,
  carrierFee: null,
  shippingFee: 30,
  cityFee: 30,
  items: [{ unitCost: 300, quantity: 1 }],
  ...o,
});
const shopSale = (o: Partial<CompareOrder> = {}) => order({ channel: SHOP_CHANNEL, carrierFee: 0, shippingFee: 0, ...o });

test("online and shop sales are counted apart, and the shop pays no delivery", () => {
  const c = compareSales([order({}), order({ channel: null, total: 300 }), shopSale({ total: 200, items: [{ unitCost: 100, quantity: 2 }] })], []);
  assert.equal(c.online.revenue, 800);
  assert.equal(c.online.sales, 2);
  assert.equal(c.online.average, 400);
  assert.equal(c.online.profit, 800 - 600 - 60);
  assert.equal(c.shop.revenue, 200);
  assert.equal(c.shop.units, 2);
  assert.equal(c.shop.profit, 0);
  assert.equal(c.total, 1000);
  assert.equal(c.shopShare, 20);
  assert.equal(c.onlineShare, 80);
});

test("a refused parcel raises the online refusal rate and earns nothing", () => {
  const c = compareSales([order({}), order({}), order({})], [order({ carrierFee: 15 })]);
  assert.equal(c.online.revenue, 1500);
  assert.equal(c.online.returned, 1);
  assert.equal(c.online.refusalRate, 25);
  assert.equal(c.online.profit, 1500 - 900 - 90 - 15);
  assert.equal(c.shop.refusalRate, null);
});

test("no sales: no shares and no averages to divide by zero", () => {
  const c = compareSales([], []);
  assert.equal(c.shopShare, null);
  assert.equal(c.onlineShare, null);
  assert.equal(c.online.average, null);
  assert.equal(c.shop.margin, null);
});
