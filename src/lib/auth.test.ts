import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken, readSessionToken, SESSION_TTL_SECONDS } from "./session";

process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";

test("passwords verify only with the right password, and hashes are salted", async () => {
  const a = await hashPassword("correct horse battery");
  const b = await hashPassword("correct horse battery");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("correct horse battery", a), true);
  assert.equal(await verifyPassword("wrong", a), false);
  assert.equal(await verifyPassword("x", "garbage"), false);
});

test("session tokens round-trip and expire", () => {
  const now = 1_800_000_000;
  const token = createSessionToken("user_1", now);
  assert.equal(readSessionToken(token, now + 10), "user_1");
  assert.equal(readSessionToken(token, now + SESSION_TTL_SECONDS + 1), null);
});

test("tampered or foreign tokens are rejected", () => {
  const now = 1_800_000_000;
  const token = createSessionToken("user_1", now);
  const [, exp, mac] = token.split(".");
  assert.equal(readSessionToken(`admin_2.${exp}.${mac}`, now), null);
  assert.equal(readSessionToken(`user_1.${Number(exp) + 9999}.${mac}`, now), null);
  assert.equal(readSessionToken("nonsense", now), null);
  assert.equal(readSessionToken(undefined, now), null);
});
