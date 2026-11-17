import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after, connection } from "next/server";
import { db } from "./db";
import { logSecurity } from "./security-log";
import { passwordStamp, readSessionToken, SESSION_COOKIE, sessionUserId } from "./session";

export async function getAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // The expiry check reads the clock: mark this as request-time so prerendering never evaluates it.
  await connection();
  const id = sessionUserId(token);
  if (!id) return null;
  const user = await db.adminUser.findUnique({
    where: { id: id.slice(0, 40) },
    select: { id: true, email: true, name: true, role: true, isActive: true, payPerConfirmed: true, payPerDelivered: true, passwordHash: true },
  });
  // Signed for this account with its current password: a changed password ends every older session.
  if (!user || readSessionToken(token, passwordStamp(user.passwordHash)) !== user.id) return null;
  // A switched-off account is out at once, even with a session still running.
  if (!user.isActive) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive, payPerConfirmed: user.payPerConfirmed, payPerDelivered: user.payPerDelivered };
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
 * otherwise. An agent who lands on an owner page goes to their own figures, and it is logged.
 */
export async function requireAdmin() {
  const user = await requireStaff();
  if (user.role !== "OWNER") {
    after(() => logSecurity("admin_denied", { userId: user.id, email: user.email }));
    redirect("/admin/me");
  }
  return user;
}
