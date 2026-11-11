import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "./db";
import { readSessionToken, SESSION_COOKIE } from "./session";

export async function getAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // The expiry check reads the clock: mark this as request-time so prerendering never evaluates it.
  await connection();
  const userId = readSessionToken(token);
  if (!userId) return null;
  const user = await db.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true, payPerConfirmed: true, payPerDelivered: true },
  });
  // A switched-off account is out at once, even with a session still running.
  return user?.isActive ? user : null;
}

/** The owner's account, or null: for route handlers, which answer 401 instead of redirecting. */
export async function getOwner() {
  const user = await getAdmin();
  return user?.role === "OWNER" ? user : null;
}

/** Anyone signed in: the owner or a confirmation agent. Only for the pages and actions agents may use. */
export async function requireStaff() {
  const user = await getAdmin();
  if (!user) redirect("/admin/login");
  return user;
}

/**
 * The owner only. Every other admin page AND server action calls this: actions are public endpoints
 * otherwise. An agent who lands on an owner page goes to their own figures.
 */
export async function requireAdmin() {
  const user = await requireStaff();
  if (user.role !== "OWNER") redirect("/admin/me");
  return user;
}
