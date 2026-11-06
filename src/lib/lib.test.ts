import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMAD } from "./money";
import { formatMoroccanPhone, normalizeMoroccanPhone, whatsappDigits } from "./phone";
import { computeTotals, type CouponRule } from "./pricing";

test("normalizes every way Moroccans write a phone number", () => {
  for (const input of ["0612345678", "06 12 34 56 78", "06-12-34-56-78", "+212612345678", "00212 6 12 34 56 78", "212612345678"]) {
    assert.equal(normalizeMoroccanPhone(input), "+212612345678", input);
  }
  assert.equal(normalizeMoroccanPhone("0712345678"), "+212712345678");
  assert.equal(normalizeMoroccanPhone("0522123456"), "+212522123456");
});

test("rejects non-Moroccan or malformed phone numbers", () => {
  for (const input of ["0812345678", "061234567", "06123456789", "+33612345678", "abc", ""]) {
    assert.equal(normalizeMoroccanPhone(input), null, input);
  }
});

test("the store's WhatsApp number is stored the way wa.me expects, however it was typed", () => {
  for (const input of ["0612345678", "06 12 34 56 78", "+212612345678", "212612345678"]) {
    assert.equal(whatsappDigits(input), "212612345678", input);
  }
  assert.equal(whatsappDigits("abc"), null);
  assert.equal(whatsappDigits("+33612345678"), null);
});

test("formats a phone number the local way", () => {
  assert.equal(formatMoroccanPhone("+212612345678"), "06 12 34 56 78");
});

const coupon = (over: Partial<CouponRule>): CouponRule => ({
  type: "PERCENT",
  value: 10,
  minSubtotal: null,
  maxUses: null,
  usedCount: 0,
  startsAt: null,
  expiresAt: null,
  isActive: true,
  ...over,
});

const now = new Date("2026-10-31T12:00:00Z");
const base = { shippingFee: 35, freeShippingThreshold: 1000, now };

test("charges shipping below the free-delivery threshold", () => {
  const t = computeTotals({ ...base, items: [{ unitPrice: 149, quantity: 2 }] });
  assert.deepEqual(t, { subtotal: 298, discount: 0, bundleDiscount: 0, shipping: 35, total: 333, couponError: null });
});

test("free delivery at exactly the threshold", () => {
  const t = computeTotals({ ...base, items: [{ unitPrice: 500, quantity: 2 }] });
  assert.equal(t.shipping, 0);
  assert.equal(t.total, 1000);
});

test("percent coupon rounds down and can drop the order below free delivery", () => {
  const t = computeTotals({ ...base, items: [{ unitPrice: 1005, quantity: 1 }], coupon: coupon({ value: 10 }) });
  assert.equal(t.discount, 100);
  assert.equal(t.shipping, 35);
  assert.equal(t.total, 1005 - 100 + 35);
});

test("fixed coupon never exceeds the subtotal", () => {
  const t = computeTotals({ ...base, items: [{ unitPrice: 30, quantity: 1 }], coupon: coupon({ type: "FIXED", value: 50 }) });
  assert.equal(t.discount, 30);
  assert.equal(t.total, 35);
});

test("invalid coupons give no discount and say why", () => {
  const items = [{ unitPrice: 400, quantity: 1 }];
  const cases: [Partial<CouponRule>, string][] = [
    [{ isActive: false }, "inactive"],
    [{ startsAt: new Date("2026-11-01") }, "not_started"],
    [{ expiresAt: now }, "expired"],
    [{ maxUses: 5, usedCount: 5 }, "used_up"],
    [{ minSubtotal: 500 }, "min_subtotal"],
  ];
  for (const [over, reason] of cases) {
    const t = computeTotals({ ...base, items, coupon: coupon(over) });
    assert.equal(t.couponError, reason);
    assert.equal(t.discount, 0);
  }
});

test("formats dirhams without decimals in both languages", () => {
  assert.match(formatMAD(8999, "en"), /8,999/);
  assert.match(formatMAD(8999, "en"), /MAD/);
  assert.match(formatMAD(8999, "ar"), /^8\s999 د\.م\.$/u);
});
