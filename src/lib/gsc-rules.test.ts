import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { gscChange, gscConfig, gscPeriods, serviceAccountAssertion, totalsOf } from "./gsc-rules";

test("the link is off until all three settings are there, and the one-line key gets its line breaks back", () => {
  assert.equal(gscConfig({ GSC_CLIENT_EMAIL: "a@b.iam.gserviceaccount.com", GSC_SITE: "sc-domain:x.ma" }), null);
  const c = gscConfig({ GSC_CLIENT_EMAIL: " a@b.iam.gserviceaccount.com ", GSC_PRIVATE_KEY: "-----BEGIN-----\\nabc\\n-----END-----", GSC_SITE: "sc-domain:x.ma" });
  assert.deepEqual(c, { email: "a@b.iam.gserviceaccount.com", key: "-----BEGIN-----\nabc\n-----END-----", site: "sc-domain:x.ma" });
});

test("the window is 28 full days ending three days ago, and the one before touches it", () => {
  const p = gscPeriods(new Date("2026-11-11T10:00:00Z"));
  assert.deepEqual(p.current, { startDate: "2026-10-12", endDate: "2026-11-08" });
  assert.deepEqual(p.previous, { startDate: "2026-09-14", endDate: "2026-10-11" });
});

test("the assertion is a JWT for the read-only scope, signed with the account's key", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwt = serviceAccountAssertion({ email: "a@b.iam.gserviceaccount.com", key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() }, 1_000);
  const [header, claims, signature] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(claims, "base64url").toString()), {
    iss: "a@b.iam.gserviceaccount.com",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: 1_000,
    exp: 4_600,
  });
  assert.ok(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url")));
});

test("no rows means nothing shown yet, and a change needs a period to compare with", () => {
  assert.deepEqual(totalsOf([]), { clicks: 0, impressions: 0, ctr: 0, position: null });
  assert.equal(totalsOf([{ clicks: 3, impressions: 120, ctr: 0.025, position: 8.4 }]).position, 8.4);
  assert.equal(gscChange(30, 20), 50);
  assert.equal(gscChange(5, 0), null);
});
