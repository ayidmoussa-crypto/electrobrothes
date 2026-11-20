import assert from "node:assert/strict";
import { test } from "node:test";
import { chartSlots, periodLabel, previousSlots, resolvePeriod } from "./period";
import { smoothPath } from "./chart-path";

test("the line before lines up slot for slot with the chosen period", () => {
  const rows = [
    { day: "2026-11-06", count: 4 }, // last day before a 7-day period starting 11-07
    { day: "2026-10-31", count: 2 }, // first day before it
    { day: "2026-11-07", count: 9 }, // inside the period: not "before"
  ];
  assert.deepEqual(previousSlots(rows, resolvePeriod({ p: "7d" }, now)), [2, 0, 0, 0, 0, 0, 4]);
  // A year shows months: each one faces the same month a year earlier.
  const year = resolvePeriod({ p: "365d" }, now);
  const before = previousSlots([{ day: "2024-11-20", count: 3 }, { day: "2025-11-02", count: 5 }], year);
  assert.equal(before.length, chartSlots([], year).points.length);
  assert.equal(before[0], 3); // Nov 2025 faces Nov 2024
  assert.equal(before.at(-1), 5); // Nov 2026 faces Nov 2025
});

test("the smooth line never dips below a flat stretch of zeros", () => {
  const d = smoothPath([[0, 100], [25, 100], [50, 10], [75, 100], [100, 100]]);
  const ys = [...d.matchAll(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  assert.ok(ys.every((y) => y <= 100 && y >= 10));
  assert.equal(smoothPath([[0, 5]]), "M0,5");
});

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

test("a page can open on another period when none is asked; an asked one always wins", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  assert.equal(resolvePeriod({}, now).preset, "30d");
  assert.equal(resolvePeriod({}, now, "month").preset, "month");
  assert.equal(resolvePeriod({}, now, "month").firstDay, "2026-11-01");
  assert.equal(resolvePeriod({ p: "30d" }, now, "month").preset, "30d");
});
