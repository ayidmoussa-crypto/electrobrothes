import assert from "node:assert/strict";
import { test } from "node:test";
import {
  base32Decode,
  base32Encode,
  hotp,
  looksLikeBackupCode,
  newBackupCodes,
  newTotpSecret,
  normalizeBackupCode,
  openTotpSecret,
  otpauthUrl,
  sealTotpSecret,
  totpCode,
  totpStep,
  verifyTotp,
} from "./totp";

// RFC 6238 appendix B: the ASCII key "12345678901234567890", SHA-1, 8 digits; the last 6 are ours.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

test("base32 round-trips and matches RFC 4648", () => {
  assert.equal(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
  assert.equal(base32Decode("mzxw 6ytb oi").toString(), "foobar");
  const s = newTotpSecret();
  assert.equal(s.length, 32);
  assert.equal(base32Decode(s).length, 20);
});

test("codes match the RFC 6238 test vectors", () => {
  const vectors: [number, string][] = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ];
  for (const [t, code] of vectors) assert.equal(totpCode(RFC_SECRET, t * 1000), code, `t=${t}`);
  assert.equal(hotp(RFC_SECRET, 0), "755224"); // RFC 4226 appendix D
});

test("a code from the step before or after is accepted, two steps away is not", () => {
  const now = 1_700_000_000_000;
  const step = totpStep(now);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), { nowMs: now }), step);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), { nowMs: now }), step - 1);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1), { nowMs: now }), step + 1);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 2), { nowMs: now }), null);
  // Spaces are fine, letters and short codes are not.
  const code = hotp(RFC_SECRET, step);
  assert.equal(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, { nowMs: now }), step);
  assert.equal(verifyTotp(RFC_SECRET, "12345", { nowMs: now }), null);
  assert.equal(verifyTotp(RFC_SECRET, "abcdef", { nowMs: now }), null);
});

test("a code already used can't be used again", () => {
  const now = 1_700_000_000_000;
  const step = totpStep(now);
  const code = hotp(RFC_SECRET, step);
  assert.equal(verifyTotp(RFC_SECRET, code, { nowMs: now, lastStep: step }), null);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1), { nowMs: now, lastStep: step }), step + 1);
});

test("the key is sealed, opens only with the same SESSION_SECRET, and refuses tampering", () => {
  const secretA = "a".repeat(40);
  const secretB = "b".repeat(40);
  const key = newTotpSecret();
  const sealed = sealTotpSecret(key, secretA);
  assert.ok(!sealed.includes(key));
  assert.equal(openTotpSecret(sealed, secretA), key);
  assert.equal(openTotpSecret(sealed, secretB), null);
  const parts = sealed.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.equal(openTotpSecret(parts.join("."), secretA), null);
  assert.equal(openTotpSecret(null, secretA), null);
});

test("backup codes: 8 distinct, readable, and recognised when typed loosely", () => {
  const codes = newBackupCodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  for (const c of codes) {
    assert.match(c, /^[a-z2-9]{5}-[a-z2-9]{5}$/);
    assert.ok(looksLikeBackupCode(c.toUpperCase().replace("-", " ")));
  }
  assert.equal(normalizeBackupCode(" ABCDE-fghjk "), "abcdefghjk");
  assert.equal(looksLikeBackupCode("123456"), false);
});

test("the setup link names the shop and the account", () => {
  const url = otpauthUrl("JBSWY3DPEHPK3PXP", "owner@shop.ma");
  assert.equal(url, "otpauth://totp/ElectroBrothers%3Aowner%40shop.ma?secret=JBSWY3DPEHPK3PXP&issuer=ElectroBrothers&algorithm=SHA1&digits=6&period=30");
});
