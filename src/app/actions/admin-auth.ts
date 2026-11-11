"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { spendSecondFactor } from "@/lib/admin-2fa";
import { db } from "@/lib/db";
import { clientIp, hit } from "@/lib/guard";
import { verifyPassword } from "@/lib/password";
import {
  createPending2faToken,
  createSessionToken,
  PENDING_2FA_COOKIE,
  PENDING_2FA_TTL_SECONDS,
  readPending2faToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/session";

export type LoginState = { error?: "invalid" | "rate_limited" | "bad_code" | "expired"; email?: string; step?: "code" };

// A real hash to compare against when the email is unknown, so timing does not reveal which emails exist.
const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge,
  path: "/",
});

async function startSession(user: { id: string; role: string }): Promise<never> {
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.delete(PENDING_2FA_COOKIE);
  jar.set(SESSION_COOKIE, createSessionToken(user.id), cookieOptions(SESSION_TTL_SECONDS));
  // An agent starts on their own figures.
  redirect(user.role === "AGENT" ? "/admin/me" : "/admin");
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  const password = String(formData.get("password") ?? "").slice(0, 200);

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([hit(`login:ip:${ip}`, 900), hit(`login:email:${email}`, 900)]);
  if (byIp > 10 || byEmail > 5) return { error: "rate_limited", email };

  const user = email ? await db.adminUser.findUnique({ where: { email } }) : null;
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  // A switched-off account answers like a wrong password: nothing tells it apart.
  if (!user || !ok || !user.isActive) return { error: "invalid", email };

  // Two-step login on: the password only earns 5 minutes to type the code, not a session.
  if (user.totpEnabledAt && user.totpSecret) {
    (await cookies()).set(PENDING_2FA_COOKIE, createPending2faToken(user.id), cookieOptions(PENDING_2FA_TTL_SECONDS));
    return { step: "code", email };
  }
  return startSession(user);
}

/** Second step: the 6-digit code from the authenticator app, or one of the backup codes. */
export async function verifyLoginCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const jar = await cookies();
  const userId = readPending2faToken(jar.get(PENDING_2FA_COOKIE)?.value);
  // Over 5 minutes, or no password step first: back to the password.
  if (!userId) return { error: "expired" };

  const ip = await clientIp();
  const [byIp, byUser] = await Promise.all([hit(`login2fa:ip:${ip}`, 900), hit(`login2fa:user:${userId}`, 900)]);
  if (byIp > 10 || byUser > 5) return { error: "rate_limited", step: "code" };

  const user = await db.adminUser.findUnique({ where: { id: userId } });
  if (!user?.isActive || !user.totpEnabledAt) return { error: "expired" };

  const result = await spendSecondFactor(user, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: "bad_code", step: "code" };
  return startSession(user);
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(PENDING_2FA_COOKIE);
  redirect("/admin/login");
}
