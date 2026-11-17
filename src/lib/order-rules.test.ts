import assert from "node:assert/strict";
import { ageLabel, filterQuery, parseOrderFilters } from "./admin-orders";
import { test } from "node:test";
import { assessRisk, canSetPrepaid, deleteBlock, deliveredByHand, undoesDelivery, cashToCollect, orderNumberAfter, ORDER_NUMBER, paymentState, shipBlock, transitionPlan } from "./order-rules";

test("board cards: age in minutes, hours, days, then the date; the view stays in links", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const at = (h: number) => new Date(now.getTime() - h * 3600_000);
  // Abbreviations vary between ICU versions: only the unit and number are checked.
  assert.match(ageLabel(at(0), now, "en-GB", "UTC"), /^1 min\.? ago$/);
  assert.match(ageLabel(at(6), now, "en-GB", "UTC"), /^6 hr\.? ago$/);
  assert.equal(ageLabel(at(24), now, "en-GB", "UTC"), "yesterday");
  assert.equal(ageLabel(at(24 * 14), now, "en-GB", "UTC"), "30 Oct");
  assert.equal(filterQuery({ status: "NEW", view: "board", page: 1 }), "?status=NEW&view=board");
  assert.equal(parseOrderFilters({ view: "board" }).view, "board");
  assert.equal(parseOrderFilters({ view: "x" }).view, undefined);
  assert.equal(parseOrderFilters({ review: "ask" }).reviewAsk, true);
  assert.equal(parseOrderFilters({ review: "x" }).reviewAsk, false);
  assert.equal(filterQuery({ reviewAsk: true, page: 1 }), "?review=ask");
});

test("only orders that never left the shop can be deleted, and never one with a review", () => {
  assert.equal(deleteBlock("NEW", null, 0), null);
  assert.equal(deleteBlock("CONFIRMED", null, 0), null);
  assert.equal(deleteBlock("CANCELLED", null, 0), null);
  assert.equal(deleteBlock("CONFIRMED", "EGW1058", 0), "shipped");
  for (const s of ["SHIPPING", "DELIVERED", "RETURNING", "RETURNED"] as const) assert.equal(deleteBlock(s, null, 0), "shipped");
  assert.equal(deleteBlock("CANCELLED", null, 1), "has_reviews");
});

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

test("order numbers count up from EB-1001, and older letter numbers can still be tracked", () => {
  assert.equal(orderNumberAfter(null), "EB-1001");
  assert.equal(orderNumberAfter(7), "EB-1001");
  assert.equal(orderNumberAfter(1001), "EB-1002");
  assert.equal(orderNumberAfter(9999), "EB-10000");
  for (const n of ["EB-1001", "EB-10000", "EB-XJUKQ3"]) assert.match(n, ORDER_NUMBER);
  for (const n of ["EB-12", "EB-xjukq3", "1001", "EB-1001 "]) assert.doesNotMatch(n, ORDER_NUMBER);
});
