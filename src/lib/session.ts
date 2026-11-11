import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless admin session: "<userId>.<expiresAtSeconds>.<hmac>" signed with SESSION_SECRET.

export const SESSION_COOKIE = "eb_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 random characters (see .env.example).");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken(userId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = `${userId}.${nowSeconds + SESSION_TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id when the token is authentic and not expired. */
export function readSessionToken(token: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)) {
  return readSigned(token, "", nowSeconds);
}

function readSigned(token: string | undefined, purpose: string, nowSeconds: number) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, mac] = parts;
  const expected = Buffer.from(sign(`${purpose}${userId}.${exp}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(exp) > nowSeconds)) return null;
  return userId;
}

// Between the password and the two-step code: proves the password was right, for 5 minutes, and is
// signed for another purpose, so it never works as a session cookie (nor a session as this).
export const PENDING_2FA_COOKIE = "eb_admin_2fa";
export const PENDING_2FA_TTL_SECONDS = 5 * 60;
const PENDING = "2fa:";

export function createPending2faToken(userId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = `${userId}.${nowSeconds + PENDING_2FA_TTL_SECONDS}`;
  return `${payload}.${sign(`${PENDING}${payload}`)}`;
}

export function readPending2faToken(token: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)) {
  return readSigned(token, PENDING, nowSeconds);
}
