import assert from "node:assert/strict";
import { test } from "node:test";
import { agentMayMove, agentStats, handledUpdate, monthRange, previousMonth } from "./staff-rules";

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

test("months", () => {
  const r = monthRange("2026-02");
  assert.equal(r.start.toISOString(), "2026-02-01T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(monthRange("junk", new Date("2026-11-11T00:00:00Z")).key, "2026-11");
  assert.equal(monthRange("2026-12").end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(previousMonth("2026-01"), "2025-12");
});
