import assert from "node:assert/strict";
import { test } from "node:test";
import { carrierTransitions } from "./status";

test("a picked-up parcel moves a confirmed order to shipping", () => {
  assert.deepEqual(carrierTransitions("CONFIRMED", "PICKED_UP"), ["SHIPPING"]);
});

test("a step inside shipping changes nothing", () => {
  assert.deepEqual(carrierTransitions("SHIPPING", "OUT_FOR_DELIVERY"), []);
  assert.deepEqual(carrierTransitions("SHIPPING", "DELIVERY_FAILED"), []);
});

test("delivered with no earlier step walks a confirmed order through shipping", () => {
  assert.deepEqual(carrierTransitions("CONFIRMED", "DELIVERED"), ["SHIPPING", "DELIVERED"]);
});

test("delivered then returned is allowed, and repeats do nothing", () => {
  assert.deepEqual(carrierTransitions("DELIVERED", "RETURNED"), ["RETURNED"]);
  assert.deepEqual(carrierTransitions("DELIVERED", "DELIVERED"), []);
});

test("parcels cannot move orders nobody confirmed or that were cancelled", () => {
  assert.equal(carrierTransitions("NEW", "PICKED_UP"), null);
  assert.equal(carrierTransitions("NEW", "DELIVERED"), null);
  assert.equal(carrierTransitions("CANCELLED", "DELIVERED"), null);
  assert.equal(carrierTransitions("RETURNED", "DELIVERED"), null);
});
