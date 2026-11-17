"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/admin";
import { adminTr, type Tr } from "@/lib/admin-lang";
import { runDueAutomations } from "@/lib/automations";
import { CARRIER_STATUSES } from "@/lib/carrier/status";
import { db } from "@/lib/db";
import { manualError, manualOrderInput } from "@/lib/manual-order";
import { canSetPrepaid, ORDER_STATUSES, shipBlock } from "@/lib/order-rules";
import { changeOrderStatus, createManualOrder, deleteOrder, OrderTransitionError } from "@/lib/orders";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { recordShipmentEvent } from "@/lib/shipments";

const sendDueMessages = () => after(() => runDueAutomations().catch((e) => console.error("[automations]", e)));

export type ActionState = { ok?: boolean; message?: string };

const statusInput = z.object({
  orderId: z.string().min(1).max(40),
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

const reasons = (tr: Tr): Record<OrderTransitionError["reason"], string> => ({
  not_found: tr("الطلب غير موجود.", "Order not found."),
  not_allowed: tr("لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية.", "The order cannot move to this status from its current one."),
  insufficient_stock: tr("المخزون غير كافٍ لتأكيد هذا الطلب", "Not enough stock to confirm this order"),
});

export async function setOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const { tr } = await adminTr();
  const parsed = statusInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: tr("طلب غير صالح.", "Invalid request.") };
  const agent = user.role === "AGENT";
  try {
    // An agent stays on the usual path (manual: false) and only answers new orders.
    await changeOrderStatus(parsed.data.orderId, parsed.data.to, user.email, parsed.data.note, { manual: !agent, agent, byId: user.id });
  } catch (e) {
    if (e instanceof OrderTransitionError) {
      if (agent && e.reason === "not_allowed") return { ok: false, message: tr("غير الطلبات الجديدة كتأكَّد ولا كتلغى من هنا. هاد الطلب تجاوب عليه من قبل.", "Only new orders can be confirmed or cancelled here. This order was already answered.") };
      return { ok: false, message: `${reasons(tr)[e.reason]}${e.sku ? ` (${e.sku})` : ""}` };
    }
    throw e;
  }
  sendDueMessages();
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, message: tr("تم تحديث حالة الطلب.", "Order status updated.") };
}

export type DeleteResult = { ok: boolean; message: string; deleted: string[] };

/** Owner only. Each order is checked on its own (lib/orders deleteOrder); the ones that cannot go are named. */
export async function deleteOrders(orderIds: string[]): Promise<DeleteResult> {
  const user = await requireAdmin();
  const { tr } = await adminTr();
  const ids = z.array(z.string().min(1).max(40)).min(1).max(200).safeParse(orderIds);
  if (!ids.success) return { ok: false, message: tr("طلب غير صالح.", "Invalid request."), deleted: [] };
  const why = {
    not_found: tr("ما بقاش موجود", "no longer exists"),
    shipped: tr("خرج مع شركة التوصيل ولا تسلّم: بدّل الحالة بلاصة الحذف", "went out with the carrier or was delivered: change its status instead"),
    has_reviews: tr("عندو تقييم ديال الزبون", "has a customer review"),
  };
  const deleted: string[] = [];
  const refused: string[] = [];
  for (const id of ids.data) {
    const r = await deleteOrder(id, user.email);
    if (r === "ok") deleted.push(id);
    else refused.push(why[r]);
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  const done = tr(`تحذف ${deleted.length} طلب.`, `${deleted.length} orders deleted.`);
  if (!refused.length) return { ok: true, message: done, deleted };
  const counts = [...new Set(refused)].map((w) => `${refused.filter((x) => x === w).length} ${w}`).join(tr("، ", ", "));
  return { ok: deleted.length > 0, message: `${deleted.length ? `${done} ` : ""}${tr("ما تحذفوش:", "Not deleted:")} ${counts}.`, deleted };
}

export type CarrierAssignResult ={ ok: boolean; message?: string; results: { id: string; ok: boolean; reason?: string }[] };

/**
 * Hands the selected orders to one delivery company: each confirmed order without a parcel number gets the
 * company (its logo then shows in the list). The others are skipped and say why. No parcel is created at the
 * company: that needs its API (lib/carrier), and nothing here pretends otherwise.
 */
export async function assignCarrier(input: { orderIds: string[]; carrierId: string }): Promise<CarrierAssignResult> {
  await requireAdmin();
  const { tr } = await adminTr();
  const parsed = z.object({ orderIds: z.array(z.string().min(1).max(40)).min(1).max(200), carrierId: z.string().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("طلب غير صالح.", "Invalid request."), results: [] };
  const carrier = await db.carrier.findFirst({ where: { id: parsed.data.carrierId, isActive: true }, select: { id: true } });
  if (!carrier) return { ok: false, message: tr("هاد الشركة ما بقاتش ولا متوقفة.", "This company no longer exists or is off."), results: [] };

  const orders = await db.order.findMany({ where: { id: { in: parsed.data.orderIds } }, select: { id: true, status: true, trackingNumber: true } });
  const why = { not_confirmed: tr("ماشي مؤكَّد", "Not confirmed"), has_tracking: tr("خرج من قبل", "Already sent") };
  const results = parsed.data.orderIds.map((id) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return { id, ok: false, reason: tr("ما بقاش", "Not found") };
    const block = shipBlock(o.status, o.trackingNumber);
    return block ? { id, ok: false, reason: why[block] } : { id, ok: true };
  });
  const ready = results.filter((r) => r.ok).map((r) => r.id);
  // The status and the parcel number are checked again in the write, in case one changed meanwhile.
  if (ready.length) await db.order.updateMany({ where: { id: { in: ready }, status: "CONFIRMED", trackingNumber: null }, data: { carrier: carrier.id } });
  revalidatePath("/admin/orders");
  return { ok: true, results };
}

/** Marks an order as paid before shipping (the carrier then collects 0), or back to cash on delivery. */
export async function setPrepaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { tr } = await adminTr();
  const locked = tr("ما يمكنش تبدل الدفع ديال طلب مسلَّم ولا ملغى.", "Payment cannot change on a delivered or cancelled order.");
  const parsed = z.object({ orderId: z.string().min(1).max(40), paid: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: tr("طلب غير صالح.", "Invalid request.") };
  const paid = parsed.data.paid === "1";
  const order = await db.order.findUnique({ where: { id: parsed.data.orderId }, select: { status: true } });
  if (!order || !canSetPrepaid(order.status)) return { ok: false, message: locked };
  // The status condition is checked again in the write, in case the order moved meanwhile.
  const updated = await db.order.updateMany({
    where: { id: parsed.data.orderId, status: { in: ["NEW", "CONFIRMED", "SHIPPING"] } },
    data: { prepaidAt: paid ? new Date() : null },
  });
  if (!updated.count) return { ok: false, message: locked };
  // Kept in the order's history, next to the status changes.
  await db.orderStatusLog.create({
    data: { orderId: parsed.data.orderId, fromStatus: order.status, toStatus: order.status, actor: admin.email, note: paid ? "تخلّص قبل الإرسال: شركة التوصيل ما تجمع والو" : "رجع للدفع عند الاستلام" },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin/finance");
  return { ok: true, message: paid ? tr("تسجل بلي مدفوع مسبقاً.", "Marked as prepaid.") : tr("رجع للدفع عند الاستلام.", "Back to cash on delivery.") };
}

/**
 * The owner opened WhatsApp with the confirmation message (sent by hand). A new order now shows
 * "waiting for the reply" until it is confirmed or cancelled. Only the first send is logged.
 */
export async function markConfirmSent(orderId: string): Promise<void> {
  const admin = await requireStaff();
  const id = z.string().min(1).max(40).safeParse(orderId);
  if (!id.success) return;
  const updated = await db.order.updateMany({ where: { id: id.data, status: "NEW", confirmSentAt: null }, data: { confirmSentAt: new Date() } });
  if (updated.count) {
    await db.orderStatusLog.create({ data: { orderId: id.data, fromStatus: "NEW", toStatus: "NEW", actor: admin.email, note: "تصيفطات رسالة التأكيد فواتساب: فانتظار الرد" } });
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id.data}`);
}

/**
 * Someone opened WhatsApp with the review request of a delivered order (sent by hand). The order leaves the
 * "waiting for a review request" list. Only the first send is logged.
 */
export async function markReviewAsked(orderId: string): Promise<void> {
  const admin = await requireStaff();
  const id = z.string().min(1).max(40).safeParse(orderId);
  if (!id.success) return;
  const updated = await db.order.updateMany({ where: { id: id.data, status: "DELIVERED", reviewAskedAt: null }, data: { reviewAskedAt: new Date() } });
  if (updated.count) {
    await db.orderStatusLog.create({ data: { orderId: id.data, fromStatus: "DELIVERED", toStatus: "DELIVERED", actor: admin.email, note: "تصيفطات رسالة طلب التقييم فواتساب" } });
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id.data}`);
}

// ───────── An order typed in from WhatsApp, a call or social media ─────────

export async function createOrderByHand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const { tr, lang } = await adminTr();
  const parsed = manualOrderInput.safeParse(Object.fromEntries([...formData].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, message: manualError(parsed.error.issues[0]?.message, lang) ?? tr("تحقق من الحقول.", "Check the fields.") };
  // A sale at the shop puts the cash in the owner's hands: only he records it.
  if (user.role === "AGENT" && parsed.data.startAs === "DELIVERED") return { ok: false, message: tr("البيع فالمحل كيسجلو غير المسؤول.", "Only the owner records a sale at the shop.") };

  const result = await createManualOrder(parsed.data, user.email, user.id);
  if (!result.ok) {
    const message = {
      blocked: tr("هذا الرقم في القائمة السوداء.", "This number is on the blacklist."),
      unavailable: tr("منتج أو مدينة لم تعد متوفرة. حدّث الصفحة.", "A product or city is no longer available. Refresh the page."),
      out_of_stock: `${tr("المخزون غير كافٍ", "Not enough stock")}${result.skus ? ` (${result.skus.join(tr("، ", ", "))})` : ""}.`,
      discount: tr("الخصم أكبر من ثمن المنتجات.", "The discount is larger than the products' price."),
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
  carrierId: z.string().max(40).optional().transform((v) => v || null),
  carrierFee: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(100_000).nullable()),
});

export async function saveShipment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const { tr } = await adminTr();
  const parsed = shipmentInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: tr("تحقق من رقم التتبع والرسوم.", "Check the tracking number and fee.") };
  const { orderId, trackingNumber, carrierFee, carrierId } = parsed.data;
  // The company's id ties the parcel to the updates that company sends (app/api/webhooks/carrier).
  const carrier = carrierId ? await db.carrier.findUnique({ where: { id: carrierId }, select: { id: true } }) : null;
  const updated = await db.order.updateMany({ where: { id: orderId }, data: { trackingNumber, carrierFee, carrier: carrier?.id ?? null } });
  if (!updated.count) return { ok: false, message: tr("الطلب غير موجود.", "Order not found.") };
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/finance");
  return { ok: true, message: tr("تم حفظ الشحنة.", "Shipment saved.") };
}

const eventInput = z.object({ orderId: z.string().min(1).max(40), status: z.enum(CARRIER_STATUSES), note: z.string().trim().max(300).optional() });

export async function addShipmentEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { tr } = await adminTr();
  const parsed = eventInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: tr("طلب غير صالح.", "Invalid request.") };
  try {
    await recordShipmentEvent(parsed.data.orderId, parsed.data.status, admin.email, parsed.data.note);
  } catch (e) {
    if (e instanceof OrderTransitionError) return { ok: false, message: e.reason === "not_allowed" ? tr("أكّد الطلب أولاً: هذه الخطوة لا تناسب حالته الحالية.", "Confirm the order first: this step does not fit its current status.") : `${reasons(tr)[e.reason]}${e.sku ? ` (${e.sku})` : ""}` };
    throw e;
  }
  sendDueMessages();
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, message: tr("تم تسجيل الخطوة.", "Step recorded.") };
}

const blacklistInput = z.object({ phone: z.string().max(30), reason: z.string().trim().max(200).optional() });

export async function addToBlacklist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const { tr } = await adminTr();
  const parsed = blacklistInput.safeParse(Object.fromEntries(formData));
  const phone = parsed.success ? normalizeMoroccanPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return { ok: false, message: tr("رقم هاتف مغربي غير صالح.", "Not a valid Moroccan phone number.") };
  await db.blacklist.upsert({
    where: { phone },
    create: { phone, reason: parsed.data.reason || null },
    update: { reason: parsed.data.reason || null },
  });
  revalidatePath("/admin/blacklist");
  revalidatePath("/admin/orders", "layout");
  return { ok: true, message: tr("تمت إضافة الرقم إلى القائمة السوداء.", "Number added to the blacklist.") };
}

export async function removeFromBlacklist(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(formData.get("id"));
  if (!id.success) return;
  await db.blacklist.delete({ where: { id: id.data } }).catch(() => null);
  revalidatePath("/admin/blacklist");
}
