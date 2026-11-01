import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSessionToken, SESSION_COOKIE } from "./session";

export async function getAdmin() {
  const userId = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return db.adminUser.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
}

/** Every admin page AND every admin server action calls this: actions are public endpoints otherwise. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
