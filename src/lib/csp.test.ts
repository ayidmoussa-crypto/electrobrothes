import assert from "node:assert/strict";
import { test } from "node:test";
import { contentSecurityPolicy } from "./csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d === name || d.startsWith(`${name} `));

test("the policy has the four locks", () => {
  const csp = contentSecurityPolicy();
  assert.equal(directive(csp, "object-src"), "object-src 'none'");
  assert.equal(directive(csp, "base-uri"), "base-uri 'self'");
  assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  assert.equal(directive(csp, "form-action"), "form-action 'self'");
});

test("Cloudinary, Turnstile and the three pixels are allowed, nothing else for scripts", () => {
  const csp = contentSecurityPolicy();
  for (const host of ["https://connect.facebook.net", "https://www.googletagmanager.com", "https://analytics.tiktok.com", "https://challenges.cloudflare.com"]) {
    assert.ok(directive(csp, "script-src")?.includes(host), host);
  }
  assert.ok(!directive(csp, "script-src")?.includes(" https: "));
  assert.ok(directive(csp, "connect-src")?.includes("https://api.cloudinary.com"));
  assert.equal(directive(csp, "frame-src"), "frame-src https://challenges.cloudflare.com");
});

test("eval and the dev websocket are allowed in development only; production upgrades http", () => {
  assert.ok(!contentSecurityPolicy().includes("'unsafe-eval'"));
  assert.ok(!contentSecurityPolicy().includes("ws:"));
  assert.ok(contentSecurityPolicy({ dev: true }).includes("'unsafe-eval'"));
  assert.equal(directive(contentSecurityPolicy(), "upgrade-insecure-requests"), "upgrade-insecure-requests");
  assert.equal(directive(contentSecurityPolicy({ dev: true }), "upgrade-insecure-requests"), undefined);
});
