import "server-only";
import { db } from "./db";
import { notifySecurityAlert } from "./notify";

export type SecurityEventType =
  | "login_ok"
  | "login_failed"
  | "login_blocked"
  | "2fa_failed"
  | "password_changed"
  | "admin_denied"
  | "admin_visit";

type Who = { email?: string | null; userId?: string | null; ip?: string | null; detail?: string | null };

/** Writes one event. Never throws: a log that fails must not lock the owner out. Never pass a password. */
export async function logSecurity(type: SecurityEventType, who: Who = {}) {
  try {
    await db.securityEvent.create({
      data: { type, email: who.email?.slice(0, 120) || null, userId: who.userId || null, ip: who.ip?.slice(0, 64) || null, detail: who.detail?.slice(0, 200) || null },
    });
    // About one write in 200 drops the events older than 180 days, so the table stays small.
    if (Math.random() < 0.005) {
      await db.securityEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 180 * 86_400_000) } } });
    }
  } catch (error) {
    console.error("[security-log] could not write", type, error instanceof Error ? error.message : "");
  }
}

/** The first attempt over a login limit: logged, and the shop gets one email per 15-minute window. */
export async function alertRepeatedFailures(email: string, ip: string) {
  await logSecurity("login_blocked", { email, ip });
  await notifySecurityAlert(
    "محاولات دخول فاشلة متكررة",
    `بزاف ديال المحاولات الفاشلة باش يدخل شي حد للوحة التحكم.\nالإيميل المستعمل: ${email || "-"}\nعنوان IP: ${ip}\n\nتسدّ الدخول لهاد الإيميل/IP لمدة 15 دقيقة. إلا ماشي نتا، بدّل كلمة السر وفعّل التحقق بخطوتين من /admin/account.`,
  );
}
