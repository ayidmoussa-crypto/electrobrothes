import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeIp, pickClientIp } from "./client-ip";

const from = (h: Record<string, string>) => (name: string) => h[name] ?? null;

test("the edge-set address wins over a client-sent X-Forwarded-For", () => {
  assert.equal(pickClientIp(from({ "x-forwarded-for": "192.0.2.55", "x-vercel-forwarded-for": "203.0.113.7" })), "203.0.113.7");
  assert.equal(pickClientIp(from({ "x-forwarded-for": "192.0.2.55, 10.0.0.1", "x-real-ip": "198.51.100.9" })), "198.51.100.9");
  assert.equal(pickClientIp(from({ "x-forwarded-for": "198.51.100.9, 10.0.0.1" })), "198.51.100.9");
  assert.equal(pickClientIp(from({})), "unknown");
});

test("every address of one IPv6 /64 is one visitor", () => {
  assert.equal(normalizeIp("2001:db8:0:1:aaaa::1"), "2001:db8:0:1::/64");
  assert.equal(normalizeIp("2001:db8:0:1:ffff:1:2:3"), "2001:db8:0:1::/64");
  assert.equal(normalizeIp("2001:DB8::1"), "2001:db8:0:0::/64");
  assert.equal(normalizeIp("[2001:db8:0:1::5]:443"), "2001:db8:0:1::/64");
  assert.equal(normalizeIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeIp("203.0.113.7"), "203.0.113.7");
});
