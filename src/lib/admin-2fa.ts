import "server-only";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { looksLikeBackupCode, newBackupCodes, normalizeBackupCode, openTotpSecret, verifyTotp } from "./totp";

type TotpUser = { id: string; totpSecret: string | null; totpLastStep: number | null; totpBackupCodes: string[] };

/**
 * Checks a 6-digit code or a backup code, and spends it: the time step is recorded (a code works once)
 * or the backup code is removed. Both are atomic, so two requests with the same code can't both pass.
 */
export async function spendSecondFactor(user: TotpUser, typed: string): Promise<{ ok: false } | { ok: true; usedBackup: boolean }> {
  const code = typed.trim().slice(0, 40);
  if (looksLikeBackupCode(code)) {
    const plain = normalizeBackupCode(code);
    for (const hash of user.totpBackupCodes) {
      if (!(await verifyPassword(plain, hash))) continue;
      const removed = await db.$executeRaw`
        UPDATE "AdminUser" SET "totpBackupCodes" = array_remove("totpBackupCodes", ${hash})
        WHERE "id" = ${user.id} AND ${hash} = ANY("totpBackupCodes")`;
      return removed === 1 ? { ok: true, usedBackup: true } : { ok: false };
    }
    return { ok: false };
  }
  const secret = openTotpSecret(user.totpSecret);
  if (!secret) return { ok: false };
  const step = verifyTotp(secret, code, { lastStep: user.totpLastStep });
  if (step === null) return { ok: false };
  const claimed = await db.adminUser.updateMany({
    where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return claimed.count === 1 ? { ok: true, usedBackup: false } : { ok: false };
}

/** 8 new backup codes: the plain ones go to the screen once, only their hashes are kept. */
export async function freshBackupCodes() {
  const codes = newBackupCodes();
  // The stored form is the normalized code (no dash), the same as what a login compares.
  const hashes = await Promise.all(codes.map((c) => hashPassword(normalizeBackupCode(c))));
  return { codes, hashes };
}
