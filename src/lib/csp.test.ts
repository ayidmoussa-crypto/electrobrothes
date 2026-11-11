import assert from "node:assert/strict";
import { test } from "node:test";
import { contentSecurityPolicy, sentryCspReportUri } from "./csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `));

test("the policy has the four locks the owner asked for", () => {
  const csp = contentSecurityPolicy();
  assert.equal(directive(csp, "object-src"), "object-src 'none'");
  assert.equal(directive(csp, "base-uri"), "base-uri 'self'");
  assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  assert.equal(directive(csp, "form-action"), "form-action 'self'");
});

test("Cloudinary, Turnstile, the three pixels and Sentry are allowed", () => {
  const csp = contentSecurityPolicy();
  for (const host of ["https://connect.facebook.net", "https://www.googletagmanager.com", "https://analytics.tiktok.com", "https://challenges.cloudflare.com"]) {
    assert.ok(directive(csp, "script-src")?.includes(host), host);
  }
  assert.ok(directive(csp, "img-src")?.includes("https://res.cloudinary.com"));
  assert.ok(directive(csp, "connect-src")?.includes("https://api.cloudinary.com"));
  assert.ok(directive(csp, "connect-src")?.includes("https://*.sentry.io"));
  assert.equal(directive(csp, "frame-src"), "frame-src https://challenges.cloudflare.com");
});

test("eval and the dev websocket are allowed in development only", () => {
  assert.ok(!contentSecurityPolicy().includes("'unsafe-eval'"));
  assert.ok(!contentSecurityPolicy().includes("ws:"));
  assert.ok(contentSecurityPolicy({ dev: true }).includes("'unsafe-eval'"));
});

test("reports go to Sentry when a DSN is set", () => {
  assert.equal(
    sentryCspReportUri("https://abc123@o456.ingest.de.sentry.io/789"),
    "https://o456.ingest.de.sentry.io/api/789/security/?sentry_key=abc123",
  );
  assert.equal(sentryCspReportUri(""), null);
  assert.equal(sentryCspReportUri(undefined), null);
  assert.equal(sentryCspReportUri("not a url"), null);
  assert.equal(sentryCspReportUri("https://o456.ingest.sentry.io/789"), null);
  const csp = contentSecurityPolicy({ reportUri: "https://x.sentry.io/api/1/security/?sentry_key=k" });
  assert.equal(directive(csp, "report-uri"), "report-uri https://x.sentry.io/api/1/security/?sentry_key=k");
  assert.equal(directive(contentSecurityPolicy(), "report-uri"), undefined);
});
