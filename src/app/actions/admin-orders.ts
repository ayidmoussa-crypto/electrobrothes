"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { runDueAutomations } from "@/lib/automations";
import { CARRIER_STATUSES } from "@/lib/carrier/status";
import { db } from "@/lib/db";
import { MANUAL_ERROR, manualOrderInput } from "@/lib/manual-order";
import { canSetPrepaid, ORDER_STATUSES } from "@/lib/order-rules";
import { changeOrderStatus, createManualOrder, OrderTransitionError } from "@/lib/orders";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { recordShipmentEvent } from "@/lib/shipments";

const sendDueMessages = () => after(() => runDueAutomations().catch((e) => console.error("[automations]", e)));

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
    await changeOrderStatus(parsed.data.orderId, parsed.data.to, admin.email, parsed.data.note, { manual: true });
  } catch (e) {
    if (e instanceof OrderTransitionError) return { ok: false, message: `${REASONS[e.reason]}${e.sku ? ` (${e.sku})` : ""}` };
    throw e;
  }
  sendDueMessages();
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, message: "تم تحديث حالة الطلب." };
}

/** Marks an order as paid before shipping (the carrier then collects 0), or back to cash on delivery. */
export async function setPrepaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ orderId: z.string().min(1).max(40), paid: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  const paid = parsed.data.paid === "1";
  const order = await db.order.findUnique({ where: { id: parsed.data.orderId }, select: { status: true } });
  if (!order || !canSetPrepaid(order.status)) return { ok: false, message: "ما يمكنش تبدل الدفع ديال طلب مسلَّم ولا ملغى." };
  // The status condition is checked again in the write, in case the order moved meanwhile.
  const updated = await db.order.updateMany({
    where: { id: parsed.data.orderId, status: { in: ["NEW", "CONFIRMED", "SHIPPING"] } },
    data: { prepaidAt: paid ? new Date() : null },
  });
  if (!updated.count) return { ok: false, message: "ما يمكنش تبدل الدفع ديال طلب مسلَّم ولا ملغى." };
  // Kept in the order's history, next to the status changes.
  await db.orderStatusLog.create({
    data: { orderId: parsed.data.orderId, fromStatus: order.status, toStatus: order.status, actor: admin.email, note: paid ? "تخلّص قبل الإرسال: شركة التوصيل ما تجمع والو" : "رجع للدفع عند الاستلام" },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin/finance");
  return { ok: true, message: paid ? "تسجل بلي مدفوع مسبقاً." : "رجع للدفع عند الاستلام." };
}

/**
 * The owner opened WhatsApp with the confirmation message (sent by hand). A new order now shows
 * "waiting for the reply" until it is confirmed or cancelled. Only the first send is logged.
 */
export async function markConfirmSent(orderId: string): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(orderId);
  if (!id.success) return;
  const updated = await db.order.updateMany({ where: { id: id.data, status: "NEW", confirmSentAt: null }, data: { confirmSentAt: new Date() } });
  if (updated.count) {
    await db.orderStatusLog.create({ data: { orderId: id.data, fromStatus: "NEW", toStatus: "NEW", actor: admin.email, note: "تصيفطات رسالة التأكيد فواتساب: فانتظار الرد" } });
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id.data}`);
}

// ───────── An order typed in from WhatsApp, a call or social media ─────────

export async function createOrderByHand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = manualOrderInput.safeParse(Object.fromEntries([...formData].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, message: MANUAL_ERROR[parsed.error.issues[0]?.message] ?? "تحقق من الحقول." };

  const result = await createManualOrder(parsed.data, admin.email);
  if (!result.ok) {
    const message = {
      blocked: "هذا الرقم في القائمة السوداء.",
      unavailable: "منتج أو مدينة لم تعد متوفرة. حدّث الصفحة.",
      out_of_stock: `المخزون غير كافٍ${result.skus ? ` (${result.skus.join("، ")})` : ""}.`,
      discount: "الخصم أكبر من ثمن المنتجات.",
    }[result.error];
    return { ok: false, message };
  }
  sendDueMessages();
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  redirect(`/admin/orders/${result.orderId}${result.confirmError ? "?unconfirmed=1" : ""}`);
}

// ───────── Shipment ─────────

const shipmentInput = z.object({
  orderId: z.string().min(1).max(40),
  trackingNumber: z.string().trim().max(60).optional().transform((v) => v || null),
  carrierFee: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(100_000).nullable()),
});

export async function saveShipment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = shipmentInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "تحقق من رقم التتبع والرسوم." };
  const { orderId, trackingNumber, carrierFee } = parsed.data;
  const updated = await db.order.updateMany({ where: { id: orderId }, data: { trackingNumber, carrierFee, carrier: trackingNumber ? "express_relais" : null } });
  if (!updated.count) return { ok: false, message: "الطلب غير موجود." };
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/finance");
  return { ok: true, message: "تم حفظ الشحنة." };
}

const eventInput = z.object({ orderId: z.string().min(1).max(40), status: z.enum(CARRIER_STATUSES), note: z.string().trim().max(300).optional() });

export async function addShipmentEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = eventInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  try {
    await recordShipmentEvent(parsed.data.orderId, parsed.data.status, admin.email, parsed.data.note);
  } catch (e) {
    if (e instanceof OrderTransitionError) return { ok: false, message: e.reason === "not_allowed" ? "أكّد الطلب أولاً: هذه الخطوة لا تناسب حالته الحالية." : `${REASONS[e.reason]}${e.sku ? ` (${e.sku})` : ""}` };
    throw e;
  }
  sendDueMessages();
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, message: "تم تسجيل الخطوة." };
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
