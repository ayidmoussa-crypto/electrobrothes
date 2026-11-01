import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { assessRisk, newOrderNumber, ORDER_NUMBER, transitionPlan } from "./order-rules";

test("confirming takes stock once, cancelling gives it back once", () => {
  assert.deepEqual(transitionPlan("NEW", "CONFIRMED", false), { allowed: true, stock: "take" });
  assert.deepEqual(transitionPlan("CONFIRMED", "SHIPPING", true), { allowed: true, stock: null });
  assert.deepEqual(transitionPlan("CONFIRMED", "CANCELLED", true), { allowed: true, stock: "give" });
  assert.deepEqual(transitionPlan("SHIPPING", "RETURNED", true), { allowed: true, stock: "give" });
  assert.deepEqual(transitionPlan("DELIVERED", "RETURNED", true), { allowed: true, stock: "give" });
  // Cancelling an unconfirmed order never touches stock.
  assert.deepEqual(transitionPlan("NEW", "CANCELLED", false), { allowed: true, stock: null });
  // Reopening a confirmed order releases its stock until it is confirmed again.
  assert.deepEqual(transitionPlan("CONFIRMED", "NEW", true), { allowed: true, stock: "give" });
});

test("illegal jumps are refused", () => {
  assert.equal(transitionPlan("NEW", "DELIVERED", false).allowed, false);
  assert.equal(transitionPlan("RETURNED", "NEW", false).allowed, false);
  assert.equal(transitionPlan("DELIVERED", "CANCELLED", true).allowed, false);
});

const clean = { blacklisted: false, recentOrdersSamePhone: 0, fillSeconds: 40, honeypotFilled: false, ordersFromIpLastHour: 0, total: 900 };

test("a normal order is clean", () => {
  assert.deepEqual(assessRisk(clean), { score: 0, flags: [], block: false });
});

test("suspicious signals add up and are explained", () => {
  const r = assessRisk({ ...clean, recentOrdersSamePhone: 1, fillSeconds: 2 });
  assert.equal(r.score, 70);
  assert.deepEqual(r.flags, ["duplicate_phone", "too_fast"]);
  assert.equal(r.block, false);
});

test("blacklist and honeypot block", () => {
  assert.equal(assessRisk({ ...clean, blacklisted: true }).block, true);
  assert.equal(assessRisk({ ...clean, honeypotFilled: true }).block, true);
  assert.equal(assessRisk({ ...clean, blacklisted: true, honeypotFilled: true }).score, 100);
});

test("order numbers are short, unambiguous and well formed", () => {
  for (let i = 0; i < 200; i++) assert.match(newOrderNumber(randomBytes), ORDER_NUMBER);
});
