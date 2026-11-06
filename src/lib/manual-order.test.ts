import assert from "node:assert/strict";
import { test } from "node:test";
import { manualOrderInput, manualTotals, suggestedShipping } from "./manual-order";

const valid = {
  items: JSON.stringify([{ variantId: "v1", qty: 2, unitPrice: 150 }]),
  name: "كريمة",
  phone: "06 12 34 56 78",
  cityId: "c1",
  address: "حي السلام",
  source: "WHATSAPP",
  shippingFee: "30",
  discount: "0",
  confirmNow: "on",
};

test("a valid order is normalized", () => {
  const p = manualOrderInput.parse(valid);
  assert.equal(p.phone, "+212612345678");
  assert.equal(p.confirmNow, true);
  assert.equal(p.items[0].qty, 2);
  assert.equal(p.notes, null);
});

test("refuses foreign phones, empty baskets, a source of WEBSITE and broken JSON", () => {
  assert.equal(manualOrderInput.safeParse({ ...valid, phone: "+33612345678" }).success, false);
  assert.equal(manualOrderInput.safeParse({ ...valid, items: "[]" }).success, false);
  assert.equal(manualOrderInput.safeParse({ ...valid, items: "{oops" }).success, false);
  assert.equal(manualOrderInput.safeParse({ ...valid, source: "WEBSITE" }).success, false);
});

test("refuses negative money and fractions", () => {
  assert.equal(manualOrderInput.safeParse({ ...valid, discount: "-5" }).success, false);
  assert.equal(manualOrderInput.safeParse({ ...valid, shippingFee: "2.5" }).success, false);
  assert.equal(manualOrderInput.safeParse({ ...valid, items: JSON.stringify([{ variantId: "v", qty: 1, unitPrice: -1 }]) }).success, false);
});

test("an unticked confirm box means not confirmed", () => {
  assert.equal(manualOrderInput.parse({ ...valid, confirmNow: undefined }).confirmNow, false);
});

test("totals with an agreed price, discount and delivery", () => {
  assert.deepEqual(manualTotals([{ unitPrice: 150, qty: 2 }], 30, 50), { subtotal: 300, shippingFee: 30, discount: 50, total: 280 });
});

test("a discount bigger than the goods has no total", () => {
  assert.equal(manualTotals([{ unitPrice: 100, qty: 1 }], 30, 101).total, null);
});

test("suggested delivery follows the shop's free-delivery threshold", () => {
  assert.equal(suggestedShipping(400, 0, 30, 500), 30);
  assert.equal(suggestedShipping(500, 0, 30, 500), 0);
  assert.equal(suggestedShipping(550, 100, 30, 500), 30);
});
