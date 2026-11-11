import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { assessRisk, canSetPrepaid, deliveredByHand, undoesDelivery, cashToCollect, newOrderNumber, ORDER_NUMBER, paymentState, shipBlock, transitionPlan } from "./order-rules";

test("only a confirmed order without a parcel number can go to the delivery company", () => {
  assert.equal(shipBlock("CONFIRMED", null), null);
  assert.equal(shipBlock("CONFIRMED", "EGW1058"), "has_tracking");
  assert.equal(shipBlock("NEW", null), "not_confirmed");
  assert.equal(shipBlock("SHIPPING", "8202"), "not_confirmed");
  assert.equal(shipBlock("CANCELLED", null), "not_confirmed");
});

test("payment follows the status, and a payment before shipping wins", () => {
  assert.equal(paymentState("NEW", false), "PENDING");
  assert.equal(paymentState("SHIPPING", false), "PENDING");
  assert.equal(paymentState("DELIVERED", false), "PAID");
  assert.equal(paymentState("RETURNED", false), "NONE");
  assert.equal(paymentState("CANCELLED", false), "NONE");
  assert.equal(paymentState("CONFIRMED", true), "PREPAID");
  assert.equal(paymentState("DELIVERED", true), "PREPAID");
});

test("a refused parcel keeps its stock out until it is back, and can still be delivered", () => {
  assert.deepEqual(transitionPlan("SHIPPING", "RETURNING", true), { allowed: true, stock: null });
  assert.deepEqual(transitionPlan("RETURNING", "RETURNED", true), { allowed: true, stock: "give" });
  assert.deepEqual(transitionPlan("RETURNING", "DELIVERED", true), { allowed: true, stock: null });
  assert.equal(transitionPlan("RETURNING", "CANCELLED", true).allowed, false);
  assert.equal(paymentState("RETURNING", false), "NONE");
});

test("by hand the owner may jump to any status, and stock still follows", () => {
  assert.equal(transitionPlan("NEW", "DELIVERED", false).allowed, false);
  assert.deepEqual(transitionPlan("NEW", "DELIVERED", false, true), { allowed: true, stock: "take" });
  assert.deepEqual(transitionPlan("RETURNED", "DELIVERED", false, true), { allowed: true, stock: "take" });
  assert.deepEqual(transitionPlan("DELIVERED", "NEW", true, true), { allowed: true, stock: "give" });
  assert.equal(transitionPlan("NEW", "NEW", false, true).allowed, false);
  assert.equal(deliveredByHand("CONFIRMED", "DELIVERED"), true);
  assert.equal(deliveredByHand("SHIPPING", "DELIVERED"), false);
});

test("taking a delivered order back before delivery undoes the delivery; a return does not", () => {
  assert.equal(undoesDelivery("DELIVERED", "CONFIRMED"), true);
  assert.equal(undoesDelivery("DELIVERED", "CANCELLED"), true);
  assert.equal(undoesDelivery("DELIVERED", "RETURNING"), false);
  assert.equal(undoesDelivery("SHIPPING", "CONFIRMED"), false);
});

test("a prepaid parcel collects nothing at the door, and the flag is locked once the parcel is done", () => {
  assert.equal(cashToCollect(1600, true), 0);
  assert.equal(cashToCollect(1600, false), 1600);
  assert.equal(canSetPrepaid("SHIPPING"), true);
  assert.equal(canSetPrepaid("DELIVERED"), false);
  assert.equal(canSetPrepaid("CANCELLED"), false);
});

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
