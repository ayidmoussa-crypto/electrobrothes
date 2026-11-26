import assert from "node:assert/strict";
import { test } from "node:test";
import { keptBundleDiscount, orderEditInput, stockChanges } from "./order-edit";

const valid = { orderId: "o1", items: JSON.stringify([{ variantId: "v1", qty: 2, unitPrice: 190 }]), shippingFee: "30", discount: "20" };

test("a valid change is read with numbers", () => {
  const p = orderEditInput.parse(valid);
  assert.equal(p.items[0].qty, 2);
  assert.equal(p.shippingFee, 30);
  assert.equal(p.discount, 20);
});

test("an order cannot be left without products, nor list a colour twice", () => {
  assert.equal(orderEditInput.safeParse({ ...valid, items: "[]" }).success, false);
  assert.equal(orderEditInput.safeParse({ ...valid, items: "not json" }).success, false);
  const twice = JSON.stringify([{ variantId: "v1", qty: 1, unitPrice: 10 }, { variantId: "v1", qty: 1, unitPrice: 10 }]);
  assert.equal(orderEditInput.safeParse({ ...valid, items: twice }).success, false);
  assert.equal(orderEditInput.safeParse({ ...valid, discount: "-5" }).success, false);
});

test("stock changes: more taken, some given back, the unchanged left out", () => {
  const before = [{ variantId: "a", quantity: 1 }, { variantId: "b", quantity: 2 }, { variantId: "c", quantity: 1 }];
  const after = [{ variantId: "a", qty: 3 }, { variantId: "c", qty: 1 }, { variantId: "d", qty: 1 }];
  assert.deepEqual(Object.fromEntries(stockChanges(before, after)), { a: 2, b: -2, d: 1 });
});

test("a pack discount stays only within the new discount", () => {
  assert.equal(keptBundleDiscount(50, 80), 50);
  assert.equal(keptBundleDiscount(50, 20), 20);
  assert.equal(keptBundleDiscount(0, 20), 0);
});
