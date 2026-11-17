import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password";
import { firstOverLimit, LOGIN_LIMITS } from "./security-limits";
import {
  createPending2faToken,
  createSessionToken,
  passwordStamp,
  PENDING_2FA_TTL_SECONDS,
  readPending2faToken,
  readSessionToken,
  SESSION_TTL_SECONDS,
  sessionUserId,
} from "./session";

process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";
const STAMP = "stamp_aaaaaaaaaa";

test("passwords verify only with the right password, and hashes are salted", async () => {
  const a = await hashPassword("correct horse battery");
  const b = await hashPassword("correct horse battery");
  assert.notEqual(a, b);
  assert.ok(a.startsWith("scrypt$"));
  assert.ok(!a.includes("correct horse battery"));
  assert.equal(await verifyPassword("correct horse battery", a), true);
  assert.equal(await verifyPassword("wrong", a), false);
  assert.equal(await verifyPassword("x", "garbage"), false);
});

test("session tokens round-trip and expire", () => {
  const now = 1_800_000_000;
  const token = createSessionToken("user_1", STAMP, now);
  assert.equal(sessionUserId(token), "user_1");
  assert.equal(readSessionToken(token, STAMP, now + 10), "user_1");
  assert.equal(readSessionToken(token, STAMP, now + SESSION_TTL_SECONDS + 1), null);
});

test("a new password ends the sessions opened with the old one", async () => {
  const now = 1_800_000_000;
  const oldStamp = passwordStamp(await hashPassword("old password 123"));
  const newStamp = passwordStamp(await hashPassword("new password 456"));
  const token = createSessionToken("user_1", oldStamp, now);
  assert.equal(readSessionToken(token, oldStamp, now + 10), "user_1");
  assert.equal(readSessionToken(token, newStamp, now + 10), null);
});

test("tampered or foreign tokens are rejected", () => {
  const now = 1_800_000_000;
  const token = createSessionToken("user_1", STAMP, now);
  const [, exp, mac] = token.split(".");
  assert.equal(readSessionToken(`admin_2.${exp}.${mac}`, STAMP, now), null);
  assert.equal(readSessionToken(`user_1.${Number(exp) + 9999}.${mac}`, STAMP, now), null);
  assert.equal(readSessionToken("nonsense", STAMP, now), null);
  assert.equal(readSessionToken(undefined, STAMP, now), null);
});

test("the password-passed token for the 2FA step is never a session, and expires in 5 minutes", () => {
  const now = 1_800_000_000;
  const pending = createPending2faToken("user_1", now);
  assert.equal(readPending2faToken(pending, now + 60), "user_1");
  assert.equal(readPending2faToken(pending, now + PENDING_2FA_TTL_SECONDS + 1), null);
  // Neither token works as the other, whatever the stamp.
  assert.equal(readSessionToken(pending, "", now + 60), null);
  assert.equal(readSessionToken(pending, STAMP, now + 60), null);
  assert.equal(readPending2faToken(createSessionToken("user_1", STAMP, now), now + 60), null);
});

test("the alert fires once per window, on the first attempt over a limit", () => {
  assert.equal(firstOverLimit(LOGIN_LIMITS.email, 1), false);
  assert.equal(firstOverLimit(LOGIN_LIMITS.email + 1, 1), true);
  assert.equal(firstOverLimit(LOGIN_LIMITS.email + 2, 1), false);
  assert.equal(firstOverLimit(1, LOGIN_LIMITS.ip + 1), true);
});
