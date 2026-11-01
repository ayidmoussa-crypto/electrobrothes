"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { ORDER_STATUSES } from "@/lib/order-rules";
import { changeOrderStatus, OrderTransitionError } from "@/lib/orders";
import { normalizeMoroccanPhone } from "@/lib/phone";

export type ActionState = { ok?: boolean; message?: string };

const statusInput = z.object({
  orderId: z.string().min(1).max(40),
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

const REASONS: Record<OrderTransitionError["reason"], string> = {
  not_found: "الطلب غير موجود.",
  not_allowed: "لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية.",
  insufficient_stock: "المخزون غير كافٍ لتأكيد هذا الطلب",
};

export async function setOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = statusInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  try {
    await changeOrderStatus(parsed.data.orderId, parsed.data.to, admin.email, parsed.data.note);
  } catch (e) {
    if (e instanceof OrderTransitionError) return { ok: false, message: `${REASONS[e.reason]}${e.sku ? ` (${e.sku})` : ""}` };
    throw e;
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, message: "تم تحديث حالة الطلب." };
}

const blacklistInput = z.object({ phone: z.string().max(30), reason: z.string().trim().max(200).optional() });

export async function addToBlacklist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = blacklistInput.safeParse(Object.fromEntries(formData));
  const phone = parsed.success ? normalizeMoroccanPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return { ok: false, message: "رقم هاتف مغربي غير صالح." };
  await db.blacklist.upsert({
    where: { phone },
    create: { phone, reason: parsed.data.reason || null },
    update: { reason: parsed.data.reason || null },
  });
  revalidatePath("/admin/blacklist");
  revalidatePath("/admin/orders", "layout");
  return { ok: true, message: "تمت إضافة الرقم إلى القائمة السوداء." };
}

export async function removeFromBlacklist(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(formData.get("id"));
  if (!id.success) return;
  await db.blacklist.delete({ where: { id: id.data } }).catch(() => null);
  revalidatePath("/admin/blacklist");
}
