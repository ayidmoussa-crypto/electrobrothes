// Two-step login codes (TOTP, RFC 6238): the 6-digit codes of Google Authenticator, Microsoft
// Authenticator, Aegis… Pure and built on node:crypto only, so no extra library and fully testable.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const BACKUP_CODE_COUNT = 8;
const ISSUER = "ElectroBrothers";

// ── Base32 (RFC 4648), the form authenticator apps take a key in ──
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new key: 160 bits, as RFC 4226 recommends, in base32. */
export const newTotpSecret = () => base32Encode(randomBytes(20));

/** The code for one time step (HOTP, RFC 4226, HMAC-SHA1 as every authenticator app expects). */
export function hotp(secret: string, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = mac[mac.length - 1] & 15;
  const n = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(n % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export const totpStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
export const totpCode = (secret: string, nowMs = Date.now()) => hotp(secret, totpStep(nowMs));

/**
 * The time step the code belongs to, or null. One step either side is accepted for a phone clock that is
 * a little off. A step at or before `lastStep` is refused: a code works once, even if someone saw it.
 */
export function verifyTotp(secret: string, code: string, opts: { nowMs?: number; lastStep?: number | null } = {}) {
  const typed = code.replace(/\s/g, "");
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(typed)) return null;
  const now = totpStep(opts.nowMs);
  for (const step of [now, now - 1, now + 1]) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(typed))) return step;
  }
  return null;
}

/** Link an authenticator app opens directly (tap on the phone), with the shop's name and the account. */
export function otpauthUrl(secret: string, account: string) {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

/** The key in groups of four, easier to type into an app by hand. */
export const groupKey = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

// ── Backup codes: for a lost phone. Stored hashed (scrypt, lib/password.ts), shown once. ──
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

/** "xxxxx-xxxxx": 10 characters of a 31-letter alphabet, about 50 bits each. */
export function newBackupCodes(count = BACKUP_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    const s = Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

/** How a typed backup code is compared: case, spaces and the dash don't matter. */
export const normalizeBackupCode = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

/** Whether the typed text looks like a backup code rather than a 6-digit code. */
export const looksLikeBackupCode = (s: string) => /^[a-z0-9]{10}$/.test(normalizeBackupCode(s)) && !/^\d+$/.test(normalizeBackupCode(s));

// ── The key at rest: AES-256-GCM, key derived from SESSION_SECRET (as lib/carrier/secrets.ts) ──
const sealKey = (secret: string) => Buffer.from(hkdfSync("sha256", secret, "electrobrothers", "admin-totp-secret", 32));

function sessionSecret(secret = process.env.SESSION_SECRET) {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to encrypt the two-step login key.");
  return secret;
}

/** "v1.<iv>.<tag>.<data>", all base64url. */
export function sealTotpSecret(plain: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(sessionSecret(secret)), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Null when empty, sealed under another SESSION_SECRET, or tampered with. */
export function openTotpSecret(sealed: string | null | undefined, secret?: string) {
  if (!sealed) return null;
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", sealKey(sessionSecret(secret)), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
