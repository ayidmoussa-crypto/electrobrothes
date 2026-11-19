"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { adminTr } from "@/lib/admin-lang";
import { MAX_MESSAGE_LENGTH, SUPPORT_GUIDE_MAX } from "@/lib/support/rules";

const refresh = (id: string) => {
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
};

/**
 * The owner closes a problem: fixed, replaced, not replaced because the cause is the use (water, charger, fall...),
 * or closed without either. The owner's call on the cause replaces the AI's guess.
 */
export async function decideSupport(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const outcome = String(fd.get("outcome") ?? "");
  const closed = { solvedByAi: false, closedAt: new Date(), closedBy: admin.email };
  if (outcome === "CUSTOMER") {
    await db.supportTicket.updateMany({ where: { id }, data: { ...closed, status: "UNSOLVED", verdict: "misuse" } });
  } else if (outcome === "REPLACED") {
    await db.supportTicket.updateMany({ where: { id }, data: { ...closed, status: "REPLACED" } });
  } else if (outcome === "SOLVED" || outcome === "UNSOLVED") {
    // A plain "not solved" is not the customer's fault: clear a "misuse" guess so the figures stay true.
    const ticket = await db.supportTicket.findUnique({ where: { id }, select: { verdict: true } });
    await db.supportTicket.updateMany({ where: { id }, data: { ...closed, status: outcome, ...(ticket?.verdict === "misuse" ? { verdict: "help" } : {}) } });
  } else return;
  refresh(id);
}

/** Opens a closed problem again, waiting for the owner (the AI does not take it back). */
export async function reopenSupport(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  await db.supportTicket.updateMany({ where: { id }, data: { status: "ESCALATED", solvedByAi: false, closedAt: null, closedBy: null } });
  refresh(id);
}

/** The owner's troubleshooting notes for one product, read by the support assistant. */
export async function saveSupportGuide(_: { ok?: boolean; message?: string }, fd: FormData) {
  await requireAdmin();
  const { tr } = await adminTr();
  const id = String(fd.get("productId") ?? "");
  const guide = String(fd.get("supportGuide") ?? "").trim();
  if (guide.length > SUPPORT_GUIDE_MAX) return { ok: false, message: tr(`الملاحظات طويلة بزاف (${SUPPORT_GUIDE_MAX} حرف كحد أقصى).`, `Too long (${SUPPORT_GUIDE_MAX} characters at most).`) };
  const done = await db.product.updateMany({ where: { id }, data: { supportGuide: guide || null } });
  if (!done.count) return { ok: false, message: tr("المنتوج ما كاينش.", "Product not found.") };
  revalidatePath(`/admin/products/${id}`);
  return { ok: true, message: tr("تسجلات الملاحظات.", "Notes saved.") };
}

/** The owner's message in the chat. From then on the owner handles it: the AI stops answering. */
export async function replySupport(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const text = String(fd.get("text") ?? "").trim().slice(0, MAX_MESSAGE_LENGTH * 2);
  if (!text) return;
  const ticket = await db.supportTicket.findUnique({ where: { id }, select: { status: true, escalatedAt: true } });
  if (!ticket) return;
  await db.$transaction([
    db.supportMessage.create({ data: { ticketId: id, role: "owner", text } }),
    db.supportTicket.update({ where: { id }, data: ticket.status === "OPEN" ? { status: "ESCALATED", escalatedAt: ticket.escalatedAt ?? new Date() } : { updatedAt: new Date() } }),
  ]);
  refresh(id);
}
