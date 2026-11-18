import assert from "node:assert/strict";
import { test } from "node:test";
import { agentBalance, agentMayMove, agentStats, handledUpdate, monthRange, previousMonth } from "./staff-rules";

test("an agent only confirms or cancels new orders", () => {
  assert.equal(agentMayMove("NEW", "CONFIRMED"), true);
  assert.equal(agentMayMove("NEW", "CANCELLED"), true);
  assert.equal(agentMayMove("NEW", "DELIVERED"), false);
  assert.equal(agentMayMove("CONFIRMED", "CANCELLED"), false);
  assert.equal(agentMayMove("CANCELLED", "CONFIRMED"), false);
});

test("leaving NEW credits who did it; going back to NEW takes the credit away", () => {
  const now = new Date("2026-11-11T10:00:00Z");
  assert.deepEqual(handledUpdate("NEW", "CONFIRMED", "u1", now), { handledById: "u1", handledAt: now, handledAs: "CONFIRMED" });
  assert.deepEqual(handledUpdate("NEW", "CANCELLED", "u1", now), { handledById: "u1", handledAt: now, handledAs: "CANCELLED" });
  // Later steps (shipping, delivery) keep the first answer.
  assert.deepEqual(handledUpdate("CONFIRMED", "SHIPPING", "u2", now), {});
  // Moved by the system (carrier, automation): nobody to credit.
  assert.deepEqual(handledUpdate("NEW", "CONFIRMED", undefined, now), {});
  assert.deepEqual(handledUpdate("CANCELLED", "NEW", "u2", now), { handledById: null, handledAt: null, handledAs: null });
});

test("an agent's figures and pay", () => {
  const s = agentStats(
    [
      { handledAs: "CONFIRMED", status: "DELIVERED" },
      { handledAs: "CONFIRMED", status: "DELIVERED" },
      { handledAs: "CONFIRMED", status: "RETURNED" },
      { handledAs: "CONFIRMED", status: "SHIPPING" },
      { handledAs: "CANCELLED", status: "CANCELLED" },
    ],
    { payPerConfirmed: 2, payPerDelivered: 10 },
  );
  assert.equal(s.handled, 5);
  assert.equal(s.confirmed, 4);
  assert.equal(s.cancelled, 1);
  assert.equal(s.delivered, 2);
  assert.equal(s.returned, 1);
  assert.equal(s.onTheWay, 1);
  assert.equal(s.confirmation, 80);
  assert.equal(s.delivery, 67);
  assert.equal(s.earnings, 4 * 2 + 2 * 10);
});

test("no orders: no rates, no pay", () => {
  const s = agentStats([], { payPerConfirmed: 5, payPerDelivered: 5 });
  assert.equal(s.confirmation, null);
  assert.equal(s.delivery, null);
  assert.equal(s.earnings, 0);
});

test("paying brings the balance to zero and new work raises it again", () => {
  const pay = { payPerConfirmed: 2, payPerDelivered: 10 };
  const before = agentBalance({ confirmed: 4, delivered: 2 }, { confirmed: 0, delivered: 0 }, pay);
  assert.deepEqual(before, { confirmed: 4, delivered: 2, amount: 28 });
  assert.equal(agentBalance({ confirmed: 4, delivered: 2 }, before, pay).amount, 0);
  // One of the paid orders is delivered later, and one new order is confirmed.
  assert.equal(agentBalance({ confirmed: 5, delivered: 3 }, before, pay).amount, 12);
});

test("a new rate only touches what is unpaid", () => {
  const paid = { confirmed: 4, delivered: 2 };
  assert.equal(agentBalance({ confirmed: 5, delivered: 2 }, paid, { payPerConfirmed: 7, payPerDelivered: 50 }).amount, 7);
});

test("an order taken back after payment comes off the next one", () => {
  const pay = { payPerConfirmed: 5, payPerDelivered: 0 };
  assert.equal(agentBalance({ confirmed: 3, delivered: 0 }, { confirmed: 4, delivered: 0 }, pay).amount, -5);
  assert.equal(agentBalance({ confirmed: 5, delivered: 0 }, { confirmed: 4, delivered: 0 }, pay).amount, 5);
});

test("months", () => {
  const r = monthRange("2026-02");
  assert.equal(r.start.toISOString(), "2026-02-01T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(monthRange("junk", new Date("2026-11-11T00:00:00Z")).key, "2026-11");
  assert.equal(monthRange("2026-12").end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(previousMonth("2026-01"), "2025-12");
});
