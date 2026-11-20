import assert from "node:assert/strict";
import { test } from "node:test";
import { cityOf, cleanPath, deviceOf, funnelSteps, isBot, isVisitId, pct, visitInput } from "./visitors";

test("the browser may only report the known events, with bounded fields", () => {
  assert.ok(visitInput.safeParse({ type: "page_view", path: "/products/x" }).success);
  assert.ok(visitInput.safeParse({ type: "add_to_cart", path: "/cart", variantId: "v1", qty: 2 }).success);
  assert.equal(visitInput.safeParse({ type: "order_placed", path: "/" }).success, false);
  assert.equal(visitInput.safeParse({ type: "page_view", path: "https://evil.example/" }).success, false);
  assert.equal(visitInput.safeParse({ type: "add_to_cart", path: "/", variantId: "v1", qty: 50 }).success, false);
  assert.equal(visitInput.safeParse({ type: "search", path: "/search", query: "x".repeat(81), results: 0 }).success, false);
});

test("robots and scripts are not visitors", () => {
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBot("facebookexternalhit/1.1"), true);
  assert.equal(isBot("WhatsApp/2.23"), true);
  assert.equal(isBot(null), true);
  assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"), false);
});

test("device kind from the user agent", () => {
  assert.equal(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-A546B) Mobile Safari/537.36"), "mobile");
  assert.equal(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(deviceOf("Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36"), "tablet");
  assert.equal(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"), "desktop");
});

test("city names are decoded and anything odd is dropped", () => {
  assert.equal(cityOf("F%C3%A8s"), "Fès");
  assert.equal(cityOf("Casablanca"), "Casablanca");
  assert.equal(cityOf("<script>"), null);
  assert.equal(cityOf("%E0%A4%A"), null);
  assert.equal(cityOf(null), null);
});

test("ids, paths and shares", () => {
  assert.equal(isVisitId("a".repeat(24)), true);
  assert.equal(isVisitId("short"), false);
  assert.equal(isVisitId("x;y".repeat(8)), false);
  assert.equal(cleanPath("/en/products/x?utm_source=ig#top"), "/en/products/x");
  assert.equal(pct(1, 3), 33.3);
  assert.equal(pct(1, 0), 0);
});

test("the purchase path shows each step against all visits and against the step before", () => {
  const steps = funnelSteps({ sessions: 200, productViews: 120, carts: 30, checkouts: 20, orders: 10, confirmed: 8, delivered: 6 });
  assert.deepEqual(steps.map((s) => s.count), [200, 120, 30, 20, 10, 8, 6]);
  assert.equal(steps[2].ofVisits, 15);
  assert.equal(steps[2].fromPrevious, 25);
  assert.equal(steps[0].fromPrevious, 100);
  assert.equal(funnelSteps({ sessions: 0, productViews: 0, carts: 0, checkouts: 0, orders: 0, confirmed: 0, delivered: 0 })[3].fromPrevious, 0);
});
