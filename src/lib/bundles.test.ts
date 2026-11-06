import assert from "node:assert/strict";
import { test } from "node:test";
import { bundleDiscount, separatePrice, type BundleRule } from "./bundles";
import { computeTotals } from "./pricing";

const headphonesAndCase: BundleRule = { id: "b1", price: 500, items: [{ productId: "head", quantity: 1 }, { productId: "case", quantity: 1 }] };
const twoCables: BundleRule = { id: "b2", price: 150, items: [{ productId: "cable", quantity: 2 }] };

test("a complete pack gives the difference to its price", () => {
  const r = bundleDiscount([{ productId: "head", unitPrice: 450, quantity: 1 }, { productId: "case", unitPrice: 100, quantity: 1 }], [headphonesAndCase]);
  assert.deepEqual(r, { discount: 50, applied: [{ bundleId: "b1", times: 1, saving: 50 }] });
});

test("an incomplete pack gives nothing", () => {
  assert.equal(bundleDiscount([{ productId: "head", unitPrice: 450, quantity: 3 }], [headphonesAndCase]).discount, 0);
  assert.equal(bundleDiscount([{ productId: "cable", unitPrice: 80, quantity: 1 }], [twoCables]).discount, 0);
});

test("the pack counts as many times as it fits, no more", () => {
  const r = bundleDiscount([{ productId: "cable", unitPrice: 80, quantity: 5 }], [twoCables]);
  assert.deepEqual(r.applied, [{ bundleId: "b2", times: 2, saving: 20 }]);
});

test("the cheapest colours are the ones matched", () => {
  // Two colours of the headphones at different prices: the pack takes the 400 one.
  const r = bundleDiscount(
    [{ productId: "head", unitPrice: 480, quantity: 1 }, { productId: "head", unitPrice: 400, quantity: 1 }, { productId: "case", unitPrice: 120, quantity: 1 }],
    [headphonesAndCase],
  );
  assert.equal(r.discount, 20);
});

test("a pack priced at or above its products never adds to the bill", () => {
  const r = bundleDiscount([{ productId: "head", unitPrice: 300, quantity: 1 }, { productId: "case", unitPrice: 100, quantity: 1 }], [headphonesAndCase]);
  assert.equal(r.discount, 0);
});

test("two packs sharing a product: the bigger saving wins the shared unit", () => {
  const small: BundleRule = { id: "s", price: 520, items: [{ productId: "head", quantity: 1 }, { productId: "case", quantity: 1 }] };
  const big: BundleRule = { id: "g", price: 480, items: [{ productId: "head", quantity: 1 }, { productId: "cable", quantity: 1 }] };
  const r = bundleDiscount(
    [{ productId: "head", unitPrice: 450, quantity: 1 }, { productId: "case", unitPrice: 100, quantity: 1 }, { productId: "cable", unitPrice: 80, quantity: 1 }],
    [small, big],
  );
  assert.deepEqual(r.applied, [{ bundleId: "g", times: 1, saving: 50 }]);
});

test("a coupon applies to what is left after the pack", () => {
  const coupon = { type: "PERCENT" as const, value: 10, minSubtotal: 500, maxUses: null, usedCount: 0, startsAt: null, expiresAt: null, isActive: true };
  const t = computeTotals({ items: [{ unitPrice: 550, quantity: 1 }], shippingFee: 35, freeShippingThreshold: 1000, coupon, bundleDiscount: 50 });
  assert.deepEqual(t, { subtotal: 550, discount: 100, bundleDiscount: 50, shipping: 35, total: 485, couponError: null });
  // The minimum is checked on the price after the pack too.
  const low = computeTotals({ items: [{ unitPrice: 540, quantity: 1 }], shippingFee: 35, freeShippingThreshold: 1000, coupon, bundleDiscount: 50 });
  assert.equal(low.couponError, "min_subtotal");
});

test("free delivery is judged after the pack discount", () => {
  const t = computeTotals({ items: [{ unitPrice: 1020, quantity: 1 }], shippingFee: 35, freeShippingThreshold: 1000, bundleDiscount: 40 });
  assert.equal(t.shipping, 35);
});

test("separate price uses the cheapest colour of each product", () => {
  assert.equal(separatePrice([{ quantity: 1, minPrice: 450 }, { quantity: 2, minPrice: 80 }]), 610);
});
