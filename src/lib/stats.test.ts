import assert from "node:assert/strict";
import { test } from "node:test";
import { codRates, fillDays } from "./stats";

test("COD rates ignore orders still waiting for the confirmation call", () => {
  const r = codRates({ NEW: 10, CONFIRMED: 5, SHIPPING: 5, DELIVERED: 6, RETURNED: 2, CANCELLED: 2 });
  assert.equal(r.total, 30);
  assert.equal(r.pending, 10);
  assert.equal(r.confirmation, 90); // 18 of 20 handled
  assert.equal(r.delivery, 75); // 6 of 8 with an outcome
  assert.equal(r.returns, 25);
});

test("rates are null, not 0 or NaN, when there is nothing to measure", () => {
  assert.deepEqual(codRates({ NEW: 3 }), { total: 3, pending: 3, confirmation: null, delivery: null, returns: null });
  assert.deepEqual(codRates({}), { total: 0, pending: 0, confirmation: null, delivery: null, returns: null });
});

test("missing days are filled with zero, oldest first", () => {
  const days = fillDays([{ day: "2026-10-30", count: 4 }], "2026-10-31", 3);
  assert.deepEqual(days, [
    { day: "2026-10-29", count: 0 },
    { day: "2026-10-30", count: 4 },
    { day: "2026-10-31", count: 0 },
  ]);
});
