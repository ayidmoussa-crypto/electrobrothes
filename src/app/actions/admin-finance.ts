"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { BUSINESS_CATEGORIES, expectedFromCarrier, PERSONAL_CATEGORIES } from "@/lib/finance";
import { moroccanDate } from "@/lib/time";

type State = { ok?: boolean; message?: string };

const fields = (fd: FormData) => Object.fromEntries([...fd].filter(([, v]) => typeof v === "string"));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => moroccanDate(v));
const amount = z.coerce.number().int().min(1).max(100_000_000);
const note = z.string().trim().max(200).optional().transform((v) => v || null);

const refresh = () => {
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
};

const expenseInput = z
  .object({ scope: z.enum(["BUSINESS", "PERSONAL"]), category: z.string().max(30), amount, spentOn: day, note })
  .refine((e) => e.category in (e.scope === "BUSINESS" ? BUSINESS_CATEGORIES : PERSONAL_CATEGORIES));

export async function addExpense(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const parsed = expenseInput.safeParse(fields(fd));
  if (!parsed.success) return { ok: false, message: "تحقق من النوع والمبلغ والتاريخ." };
  await db.expense.create({ data: { ...parsed.data, actor: admin.email } });
  refresh();
  return { ok: true, message: "تمت الإضافة." };
}

export async function deleteExpense(fd: FormData) {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(fd.get("id"));
  if (!id.success) return;
  await db.expense.delete({ where: { id: id.data } }).catch(() => null);
  refresh();
}

const capitalInput = z.object({ type: z.enum(["INJECTION", "WITHDRAWAL"]), amount, occurredOn: day, note });

export async function addCapital(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const parsed = capitalInput.safeParse(fields(fd));
  if (!parsed.success) return { ok: false, message: "تحقق من المبلغ والتاريخ." };
  await db.capitalEntry.create({ data: { ...parsed.data, actor: admin.email } });
  refresh();
  return { ok: true, message: "تمت الإضافة." };
}

export async function deleteCapital(fd: FormData) {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(fd.get("id"));
  if (!id.success) return;
  await db.capitalEntry.delete({ where: { id: id.data } }).catch(() => null);
  refresh();
}

/** The carrier paid for the ticked orders, each at what it should hand over (cash minus its fee). */
export async function markCodReceived(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const ids = z.array(z.string().min(1).max(40)).min(1).max(200).safeParse(fd.getAll("orderId"));
  if (!ids.success) return { ok: false, message: "اختر طلباً واحداً على الأقل." };
  const [orders, settings] = await Promise.all([
    db.order.findMany({ where: { id: { in: ids.data }, status: "DELIVERED", codReceivedAt: null }, select: { id: true, total: true, carrierFee: true } }),
    db.settings.findUnique({ where: { id: 1 }, select: { defaultDeliveryCost: true } }),
  ]);
  const now = new Date();
  await db.$transaction(
    orders.map((o) =>
      db.order.updateMany({
        where: { id: o.id, codReceivedAt: null },
        data: { codReceivedAt: now, codReceivedAmount: expectedFromCarrier(o.total, o.carrierFee, settings?.defaultDeliveryCost ?? 0) },
      }),
    ),
  );
  refresh();
  revalidatePath("/admin/orders");
  return { ok: true, message: `تم تسجيل ${orders.length} تحويل.` };
}

const oneInput = z.object({
  orderId: z.string().min(1).max(40),
  amount: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(100_000_000).nullable()),
});

/** One order, with the amount really received; an empty amount takes the mark away again. */
export async function setCodReceived(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const parsed = oneInput.safeParse(fields(fd));
  if (!parsed.success) return { ok: false, message: "تحقق من المبلغ." };
  const { orderId, amount: received } = parsed.data;
  await db.order.updateMany({ where: { id: orderId }, data: { codReceivedAmount: received, codReceivedAt: received === null ? null : new Date() } });
  refresh();
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true, message: received === null ? "تم حذف التحويل." : "تم تسجيل التحويل." };
}
