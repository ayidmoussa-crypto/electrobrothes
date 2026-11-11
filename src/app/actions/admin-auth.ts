"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientIp, hit } from "@/lib/guard";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";

export type LoginState = { error?: "invalid" | "rate_limited"; email?: string };

// A real hash to compare against when the email is unknown, so timing does not reveal which emails exist.
const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

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

  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  // An agent starts on their own figures.
  redirect(user.role === "AGENT" ? "/admin/me" : "/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}
