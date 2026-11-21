"use server";

import { expireAdminStats } from "@/lib/admin-stats-tag";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { logSecurity } from "@/lib/security-log";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { hashPassword } from "@/lib/password";
import { loadBalances } from "@/lib/staff";
import { moroccanDate, toMoroccanInput } from "@/lib/time";

type State = { ok?: boolean; message?: string };

const refreshPay = () => {
  expireAdminStats();
  for (const path of ["/admin/staff", "/admin/me", "/admin/finance", "/admin"]) revalidatePath(path);
};

const payInput = z.object({ id: z.string().min(1).max(40), amount: z.coerce.number().int().min(1).max(100_000_000) });

/**
 * The owner paid an agent all that is due: the balance goes back to 0 and the money becomes a salary expense
 * today, so it comes off this month's profit. The amount on the owner's screen must still be the balance.
 */
export async function payAgent(_: State, fd: FormData): Promise<State> {
  const owner = await requireAdmin();
  const { tr, lang } = await adminTr();
  const parsed = payInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: tr("ما كاين ما يتخلص.", "Nothing to pay.") };
  const { id, amount } = parsed.data;
  const result = await db.$transaction(async (tx) => {
    // One payment at a time for an agent: a double click cannot pay twice.
    const [agent] = await tx.$queryRaw<{ id: string; name: string; payPerConfirmed: number; payPerDelivered: number }[]>`
      SELECT "id", "name", "payPerConfirmed", "payPerDelivered" FROM "AdminUser" WHERE "id" = ${id} AND "role" = 'AGENT' FOR UPDATE`;
    if (!agent) return "missing" as const;
    const balance = (await loadBalances(tx, id))(agent);
    if (balance.amount !== amount) return "changed" as const;
    const expense = await tx.expense.create({
      data: {
        scope: "BUSINESS",
        category: "SALARY",
        amount,
        spentOn: moroccanDate(toMoroccanInput(new Date(), 10)),
        note: tr(`خلصة ${agent.name}`, `${agent.name}'s pay`).slice(0, 200),
        actor: owner.email,
      },
      select: { id: true },
    });
    await tx.agentPayment.create({
      data: { agentId: id, expenseId: expense.id, amount, confirmedCount: balance.confirmed, deliveredCount: balance.delivered, actor: owner.email },
    });
    return "paid" as const;
  });
  if (result === "missing") return { ok: false, message: tr("هاد الموظف ما بقاش.", "This agent no longer exists.") };
  refreshPay();
  if (result === "changed") return { ok: false, message: tr("الرصيد تبدل. شوف المبلغ الجديد وعاود.", "The balance changed. Check the new amount and try again.") };
  return { ok: true, message: tr(`تسجل الخلاص ديال ${formatMAD(amount, lang)}.`, `Payment of ${formatMAD(amount, lang)} recorded.`) };
}

/** A payment recorded by mistake: its expense goes, and the balance comes back. */
export async function cancelAgentPayment(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const { tr } = await adminTr();
  const id = z.string().min(1).max(40).safeParse(fd.get("id"));
  const payment = id.success ? await db.agentPayment.findUnique({ where: { id: id.data }, select: { expenseId: true } }) : null;
  if (payment) await db.expense.delete({ where: { id: payment.expenseId } }).catch(() => null);
  refreshPay();
  return { ok: true, message: tr("تلغى الخلاص.", "Payment cancelled.") };
}

const MIN_PASSWORD = 10;
const pay = z.coerce.number().int().min(0).max(10_000);

const createInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(MIN_PASSWORD).max(200),
  payPerConfirmed: pay,
  payPerDelivered: pay,
});

/** A new confirmation agent: signs in on /admin/login and only sees orders and their figures. */
export async function createAgent(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const { tr } = await adminTr();
  const parsed = createInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      ok: false,
      message:
        field === "password"
          ? tr(`كلمة السر خاصها ${MIN_PASSWORD} حروف على الأقل.`, `The password needs at least ${MIN_PASSWORD} characters.`)
          : field === "email"
            ? tr("الإيميل ماشي صحيح.", "The email is not valid.")
            : tr("تحقق من الاسم والمبالغ.", "Check the name and the amounts."),
    };
  }
  const { password, ...data } = parsed.data;
  if (await db.adminUser.findUnique({ where: { email: data.email }, select: { id: true } })) {
    return { ok: false, message: tr("هاد الإيميل عندو حساب من قبل.", "This email already has an account.") };
  }
  await db.adminUser.create({ data: { ...data, role: "AGENT", passwordHash: await hashPassword(password) } });
  revalidatePath("/admin/staff");
  return { ok: true, message: tr("تزاد الموظف. عطيه الإيميل وكلمة السر باش يدخل.", "Agent added. Give them the email and password to sign in.") };
}

const updateInput = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(2).max(80),
  payPerConfirmed: pay,
  payPerDelivered: pay,
  active: z.enum(["1", "0"]),
  // Empty = keep the current one.
  password: z.string().max(200).optional().transform((v) => v || null),
});

/** Name, pay, on/off and an optional new password. Owner accounts are never touched from here. */
export async function updateAgent(_: State, fd: FormData): Promise<State> {
  const owner = await requireAdmin();
  const { tr } = await adminTr();
  const parsed = updateInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: tr("تحقق من الاسم والمبالغ.", "Check the name and the amounts.") };
  const { id, password, active, ...data } = parsed.data;
  if (password && password.length < MIN_PASSWORD) return { ok: false, message: tr(`كلمة السر خاصها ${MIN_PASSWORD} حروف على الأقل.`, `The password needs at least ${MIN_PASSWORD} characters.`) };
  const updated = await db.adminUser.updateMany({
    where: { id, role: "AGENT" },
    data: { ...data, isActive: active === "1", ...(password ? { passwordHash: await hashPassword(password) } : {}) },
  });
  if (!updated.count) return { ok: false, message: tr("هاد الموظف ما بقاش.", "This agent no longer exists.") };
  // A new password also ends the agent's open sessions (the session stamp follows the password).
  if (password) after(() => logSecurity("password_changed", { userId: id, email: owner.email, detail: "agent password set by the owner" }));
  revalidatePath("/admin/staff");
  return { ok: true, message: tr("تحفظ.", "Saved.") };
}
