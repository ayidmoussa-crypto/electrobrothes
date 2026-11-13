import assert from "node:assert/strict";
import { test } from "node:test";
import { chartSlots, periodLabel, resolvePeriod } from "./period";

const now = new Date("2026-11-13T10:00:00Z");

test("a preset counts whole days up to now, today included", () => {
  const p = resolvePeriod({ p: "7d" }, now);
  assert.equal(p.firstDay, "2026-11-07");
  assert.equal(p.lastDay, "2026-11-13");
  assert.equal(p.days, 7);
  assert.equal(p.until.getTime(), now.getTime());
  assert.equal(p.query, "p=7d");
});

test("this month starts on the 1st, even when it has just begun", () => {
  const p = resolvePeriod({ p: "month" }, now);
  assert.equal(p.firstDay, "2026-11-01");
  assert.equal(p.days, 13);
  const first = resolvePeriod({ p: "month" }, new Date("2026-12-01T00:30:00Z"));
  assert.equal(first.firstDay, "2026-12-01");
  assert.equal(first.days, 1);
});

test("last month is the whole previous calendar month, across a new year too", () => {
  const p = resolvePeriod({ p: "lastMonth" }, now);
  assert.equal(p.firstDay, "2026-10-01");
  assert.equal(p.lastDay, "2026-10-31");
  assert.equal(p.days, 31);
  assert.equal(p.until.toISOString(), "2026-10-31T23:59:59.999Z");
  assert.equal(resolvePeriod({ p: "lastMonth" }, new Date("2027-01-05T08:00:00Z")).firstDay, "2026-12-01");
});

test("custom dates: both days included, swapped if reversed, never past today", () => {
  const p = resolvePeriod({ from: "2026-11-20", to: "2021-11-13" }, now);
  assert.equal(p.firstDay, "2021-11-13");
  assert.equal(p.lastDay, "2026-11-13");
  assert.equal(p.until.getTime(), now.getTime());
  assert.equal(p.preset, null);
  assert.equal(p.query, "from=2021-11-13&to=2026-11-13");

  const past = resolvePeriod({ from: "2026-03-01", to: "2026-03-31" }, now);
  assert.equal(past.days, 31);
  assert.equal(past.until.toISOString(), "2026-03-31T23:59:59.999Z");
});

test("the period before has the same length and ends where this one starts", () => {
  const p = resolvePeriod({ p: "30d" }, now);
  assert.equal(p.from.getTime() - p.prevFrom.getTime(), p.until.getTime() + 1 - p.from.getTime());
});

test("bad or missing input falls back to 30 days; the old ?days= still works", () => {
  assert.equal(resolvePeriod({}, now).preset, "30d");
  assert.equal(resolvePeriod({ p: "12d" }, now).preset, "30d");
  assert.equal(resolvePeriod({ from: "2026-02-30", to: "2026-03-01" }, now).preset, "30d");
  assert.equal(resolvePeriod({ days: "90" }, now).preset, "90d");
});

test("labels", () => {
  assert.equal(periodLabel(resolvePeriod({ p: "30d" }, now), "ar"), "آخر 30 يوم");
  assert.equal(periodLabel(resolvePeriod({ p: "month" }, now), "en"), "this month");
  assert.equal(periodLabel(resolvePeriod({ from: "2024-01-01", to: "2024-01-31" }, now), "en"), "01/01/2024 – 31/01/2024");
});

test("chart slots: days up to a quarter, then months", () => {
  const week = chartSlots([{ day: "2026-11-12", count: 3 }], resolvePeriod({ p: "7d" }, now));
  assert.equal(week.monthly, false);
  assert.equal(week.points.length, 7);
  assert.deepEqual(week.points[5], { key: "2026-11-12", count: 3 });

  const years = chartSlots(
    [
      { day: "2025-01-02", count: 2 },
      { day: "2025-01-30", count: 1 },
    ],
    resolvePeriod({ from: "2024-11-13", to: "2026-11-13" }, now),
  );
  assert.equal(years.monthly, true);
  assert.equal(years.points.length, 25);
  assert.deepEqual(years.points.find((s) => s.key === "2025-01-01"), { key: "2025-01-01", count: 3 });
});
