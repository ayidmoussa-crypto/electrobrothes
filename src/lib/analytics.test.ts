import assert from "node:assert/strict";
import { test } from "node:test";
import { toPlatformCalls } from "./analytics";

const item = { id: "v1", name: "Galaxy A55", price: 3999, quantity: 2 };

test("add to cart maps to each platform's standard event with MAD value", () => {
  const c = toPlatformCalls({ name: "AddToCart", items: [item] });
  assert.deepEqual(c.meta.slice(0, 2), ["track", "AddToCart"]);
  assert.equal((c.meta[2] as { value: number }).value, 7998);
  assert.equal((c.meta[2] as { currency: string }).currency, "MAD");
  assert.equal(c.ga4[1], "add_to_cart");
  assert.equal(c.tiktok[0], "AddToCart");
});

test("purchase carries the order number for deduplication and the charged total", () => {
  const c = toPlatformCalls({ name: "Purchase", items: [item], orderNumber: "EB-7KQ4ZP", value: 7333 });
  assert.deepEqual(c.meta[3], { eventID: "EB-7KQ4ZP" });
  assert.equal((c.meta[2] as { value: number }).value, 7333);
  assert.equal(c.ga4[1], "purchase");
  assert.equal((c.ga4[2] as { transaction_id: string }).transaction_id, "EB-7KQ4ZP");
  assert.equal(c.tiktok[0], "CompletePayment");
  assert.equal((c.tiktok[1] as { event_id: string }).event_id, "EB-7KQ4ZP");
});

test("checkout start maps to begin_checkout on GA4", () => {
  assert.equal(toPlatformCalls({ name: "InitiateCheckout", items: [item] }).ga4[1], "begin_checkout");
  assert.equal(toPlatformCalls({ name: "ViewContent", items: [item] }).ga4[1], "view_item");
});
