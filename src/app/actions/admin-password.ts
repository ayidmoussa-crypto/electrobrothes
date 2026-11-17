"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { clientIp, hit } from "@/lib/guard";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logSecurity } from "@/lib/security-log";
import { createSessionToken, passwordStamp, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";

type State = { ok?: boolean; message?: string };

const input = z.object({ current: z.string().min(1).max(200), next: z.string().min(12).max(200), again: z.string().max(200) });

/**
 * The owner's own password, with the current one. Every other session of the account ends at once
 * (the session stamp follows the password); this browser gets a fresh session and stays in.
 */
export async function changeOwnPassword(_: State, fd: FormData): Promise<State> {
  const me = await requireAdmin();
  const { tr } = await adminTr();
  if ((await hit(`password:change:${me.id}`, 900)) > 5) return { ok: false, message: tr("محاولات كثيرة. انتظر 15 دقيقة.", "Too many attempts. Wait 15 minutes.") };

  const parsed = input.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: tr("كلمة السر الجديدة خاصها 12 حرف على الأقل.", "The new password needs at least 12 characters.") };
  const { current, next, again } = parsed.data;
  if (next !== again) return { ok: false, message: tr("كلمتا السر الجديدتان ماشي بحال بحال.", "The two new passwords don't match.") };

  const user = await db.adminUser.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(current, user.passwordHash))) return { ok: false, message: tr("كلمة السر الحالية غالطة.", "The current password is wrong.") };

  const passwordHash = await hashPassword(next);
  await db.adminUser.update({ where: { id: me.id }, data: { passwordHash } });
  (await cookies()).set(SESSION_COOKIE, createSessionToken(me.id, passwordStamp(passwordHash)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  const ip = await clientIp();
  after(() => logSecurity("password_changed", { userId: me.id, email: me.email, ip, detail: "own password" }));
  return { ok: true, message: tr("تبدلات كلمة السر. الأجهزة الأخرى خرجات.", "Password changed. Other devices are signed out.") };
}
