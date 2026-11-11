"use server";

import { revalidatePath } from "next/cache";
import { freshBackupCodes, spendSecondFactor } from "@/lib/admin-2fa";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { hit } from "@/lib/guard";
import { newTotpSecret, openTotpSecret, sealTotpSecret, verifyTotp } from "@/lib/totp";

type State = { ok?: boolean; message?: string };
export type ConfirmState = State & { backupCodes?: string[] };

const totpFields = { id: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true, totpBackupCodes: true } as const;

/** The owner's account, with the two-step fields. requireAdmin: agents can't turn it on. */
async function owner() {
  const me = await requireAdmin();
  return db.adminUser.findUniqueOrThrow({ where: { id: me.id }, select: totpFields });
}

/** Step 1: a new key, saved sealed but not active until a correct code is typed. */
export async function start2faSetup() {
  const user = await owner();
  if (user.totpEnabledAt) return;
  await db.adminUser.update({ where: { id: user.id }, data: { totpSecret: sealTotpSecret(newTotpSecret()), totpLastStep: null } });
  revalidatePath("/admin/account");
}

/** Leaves a setup that was started but never confirmed. */
export async function cancel2faSetup() {
  const user = await owner();
  if (user.totpEnabledAt) return;
  await db.adminUser.update({ where: { id: user.id }, data: { totpSecret: null, totpLastStep: null } });
  revalidatePath("/admin/account");
}

/** Step 2: the code from the app proves it was added; only then is two-step login on. */
export async function confirm2faSetup(_: ConfirmState, fd: FormData): Promise<ConfirmState> {
  const user = await owner();
  const { tr } = await adminTr();
  if (user.totpEnabledAt) return { ok: false, message: tr("التحقق بخطوتين مفعّل من قبل.", "Two-step login is already on.") };
  if ((await hit(`2fa:setup:${user.id}`, 900)) > 10) return { ok: false, message: tr("محاولات كثيرة. انتظر 15 دقيقة.", "Too many attempts. Wait 15 minutes.") };

  const secret = openTotpSecret(user.totpSecret);
  if (!secret) return { ok: false, message: tr("بدا التفعيل من جديد.", "Start the setup again.") };
  const step = verifyTotp(secret, String(fd.get("code") ?? ""));
  if (step === null) return { ok: false, message: tr("الرمز غير صحيح. تأكد من ساعة الهاتف وعاود.", "Wrong code. Check the phone's clock and try again.") };

  const { codes, hashes } = await freshBackupCodes();
  await db.adminUser.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), totpLastStep: step, totpBackupCodes: hashes } });
  // No revalidate here: the page would replace this form before the codes are read. "Done" refreshes it.
  return { ok: true, backupCodes: codes };
}

/** Off, with a current code (or a backup code). For a lost phone, see scripts/admin-2fa-off.ts. */
export async function disable2fa(_: State, fd: FormData): Promise<State> {
  const user = await owner();
  const { tr } = await adminTr();
  if (!user.totpEnabledAt) return { ok: true };
  if ((await hit(`2fa:manage:${user.id}`, 900)) > 5) return { ok: false, message: tr("محاولات كثيرة. انتظر 15 دقيقة.", "Too many attempts. Wait 15 minutes.") };
  const result = await spendSecondFactor(user, String(fd.get("code") ?? ""));
  if (!result.ok) return { ok: false, message: tr("الرمز غير صحيح أو مستعمل من قبل.", "Wrong code, or already used.") };
  await db.adminUser.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpBackupCodes: [] } });
  revalidatePath("/admin/account");
  return { ok: true, message: tr("تطفى التحقق بخطوتين.", "Two-step login is off.") };
}

/** 8 new backup codes in place of the old ones (all of them stop working), with a current code. */
export async function regenerateBackupCodes(_: ConfirmState, fd: FormData): Promise<ConfirmState> {
  const user = await owner();
  const { tr } = await adminTr();
  if (!user.totpEnabledAt) return { ok: false };
  if ((await hit(`2fa:manage:${user.id}`, 900)) > 5) return { ok: false, message: tr("محاولات كثيرة. انتظر 15 دقيقة.", "Too many attempts. Wait 15 minutes.") };
  const result = await spendSecondFactor(user, String(fd.get("code") ?? ""));
  if (!result.ok) return { ok: false, message: tr("الرمز غير صحيح أو مستعمل من قبل.", "Wrong code, or already used.") };
  const { codes, hashes } = await freshBackupCodes();
  await db.adminUser.update({ where: { id: user.id }, data: { totpBackupCodes: hashes } });
  return { ok: true, backupCodes: codes };
}
