import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptCredentials, encryptCredentials, mergeCredentials, savedFields } from "./secrets";
import { buildStatusMap, parseCarrierPayload, readPath, trackingLink } from "./webhook";

const SECRET = "x".repeat(40);

test("credentials come back only with the same secret, and a typed field replaces only itself", () => {
  const sealed = encryptCredentials({ apiKey: "k-123", login: "shop" }, SECRET);
  assert.ok(!sealed.includes("k-123"));
  assert.deepEqual(decryptCredentials(sealed, SECRET), { apiKey: "k-123", login: "shop" });
  assert.equal(decryptCredentials(sealed, "y".repeat(40)), null);
  const parts = sealed.split(".");
  parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
  assert.equal(decryptCredentials(parts.join("."), SECRET), null);
  assert.deepEqual(mergeCredentials({ apiKey: "old", login: "shop" }, { apiKey: "", password: " new " }), { apiKey: "old", login: "shop", password: "new" });
  assert.deepEqual(savedFields({ apiKey: "a" }), { apiKey: true, login: false, password: false });
});

test("fields are read by path, arrays included", () => {
  assert.equal(readPath({ data: { parcel: { status: "Livré" } } }, "data.parcel.status"), "Livré");
  assert.equal(readPath({ events: [{ code: 7 }] }, "events.0.code"), 7);
  assert.equal(readPath(null, "a.b"), undefined);
});

test("their status names map onto ours, without case or spacing; unmapped ones come back for the owner", () => {
  const statusMap = buildStatusMap([
    { from: "Livré", to: "DELIVERED" },
    { from: "  En   cours ", to: "IN_TRANSIT" },
    { from: "Bizarre", to: "NOT_A_STATUS" },
  ]);
  assert.deepEqual(statusMap, { "livré": "DELIVERED", "en cours": "IN_TRANSIT" });
  const f = { trackingField: "data.tracking", statusField: "data.status", noteField: "data.comment", statusMap };
  assert.deepEqual(parseCarrierPayload({ data: { tracking: "ER123", status: "LIVRÉ", comment: "Remis au client" } }, f), [
    { tracking: "ER123", status: "DELIVERED", note: "Remis au client", raw: "LIVRÉ" },
  ]);
  assert.deepEqual(parseCarrierPayload({ data: { tracking: "ER9", status: "Retour expéditeur" } }, f), [{ tracking: "ER9", status: null, note: null, raw: "Retour expéditeur" }]);
});

test("a list of events, or events without a tracking number or status, are handled", () => {
  const f = { trackingField: "tracking", statusField: "status", noteField: null, statusMap: {} };
  const events = parseCarrierPayload({ events: [{ tracking: "A1", status: "delivered" }, { tracking: "", status: "x" }, { status: "x" }] }, f);
  assert.deepEqual(events, [{ tracking: "A1", status: "DELIVERED", note: null, raw: "delivered" }]);
  assert.equal(parseCarrierPayload([{ tracking: 42, status: "PICKED_UP" }], f)[0].tracking, "42");
  assert.deepEqual(parseCarrierPayload("not json object", f), []);
});

test("the tracking page link fills in the parcel number when it has a slot", () => {
  assert.equal(trackingLink("https://c.ma/track?n={tracking}", "AB 1"), "https://c.ma/track?n=AB%201");
  assert.equal(trackingLink("https://c.ma/suivi", "AB1"), "https://c.ma/suivi");
  assert.equal(trackingLink(null, "AB1"), null);
});
