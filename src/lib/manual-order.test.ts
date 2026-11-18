import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeTouch, SHOP_CHANNEL } from "./attribution";
import { IN_SHOP_ADDRESS, manualOrderInput, manualTotals, orderSourceLabel, suggestedShipping } from "./manual-order";

const valid = {
  items: JSON.stringify([{ variantId: "v1", qty: 2, unitPrice: 150 }]),
  name: "كريمة",
  phone: "06 12 34 56 78",
  cityId: "c1",
  address: "حي السلام",
  source: "WHATSAPP",
  shippingFee: "30",
  discount: "0",
  startAs: "CONFIRMED",
};

test("a valid order is normalized", () => {
  const p = manualOrderInput.parse(valid);
  assert.equal(p.phone, "+212612345678");
  assert.equal(p.startAs, "CONFIRMED");
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

test("an order starts confirmed unless told otherwise", () => {
  assert.equal(manualOrderInput.parse({ ...valid, startAs: undefined }).startAs, "CONFIRMED");
  assert.equal(manualOrderInput.parse({ ...valid, startAs: "NEW" }).startAs, "NEW");
  assert.equal(manualOrderInput.safeParse({ ...valid, startAs: "SHIPPING" }).success, false);
});

test("a sale at the shop needs no address; a delivery does", () => {
  assert.equal(manualOrderInput.parse({ ...valid, address: "", startAs: "DELIVERED" }).address, IN_SHOP_ADDRESS);
  assert.equal(manualOrderInput.parse({ ...valid, startAs: "DELIVERED" }).address, "حي السلام");
  assert.equal(manualOrderInput.safeParse({ ...valid, address: "" }).success, false);
});

test("a shop sale never carries a delivery fee and reads as the shop", () => {
  const sale = manualOrderInput.parse({ ...valid, startAs: "DELIVERED" });
  assert.equal(sale.shippingFee, 0);
  assert.equal(sale.source, "OTHER");
  assert.equal(orderSourceLabel({ source: sale.source, channel: SHOP_CHANNEL }), "المحل");
  assert.equal(orderSourceLabel({ source: "WHATSAPP", channel: "WHATSAPP" }), "واتساب");
  assert.equal(decodeTouch(SHOP_CHANNEL), null);
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
