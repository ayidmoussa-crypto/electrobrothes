"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientIp, hit } from "@/lib/guard";
import { notifySupportEscalated } from "@/lib/notify";
import { ORDER_NUMBER } from "@/lib/order-rules";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { runSupportTurn } from "@/lib/support/chat";
import { orderFromSupportToken, supportAccess, supportPath } from "@/lib/support/customer";
import { randomInt } from "node:crypto";
import { MAX_CUSTOMER_MESSAGES, MAX_MESSAGE_LENGTH, MAX_MESSAGES_PER_HOUR, rewardCode, rewardExpiry, SUPPORT_AI_PER_PHONE_PER_DAY, SUPPORT_FIND_PER_PHONE } from "@/lib/support/rules";

export type FindSupportState = { error?: "invalid" | "not_found" | "not_delivered" | "rate_limited"; values?: { number: string; phone: string } };

/**
 * Order number + phone → the private support page of THAT order, which must have been delivered. The phone is never
 * verified (no OTP), so any order that merely carries it proves nothing: someone could place one with a stranger's
 * number. A delivered order does, as only its real buyer received it. From there the page shows every delivered order
 * of that phone (lib/support/customer supportAccess).
 */
export async function findSupport(locale: string, _prev: FindSupportState, fd: FormData): Promise<FindSupportState> {
  const values = { number: String(fd.get("number") ?? "").slice(0, 20), phone: String(fd.get("phone") ?? "").slice(0, 20) };
  const number = values.number.trim().toUpperCase();
  const phone = normalizeMoroccanPhone(values.phone);
  if (!ORDER_NUMBER.test(number) || !phone) return { error: "invalid", values };
  if ((await hit(`support-find:ip:${await clientIp()}`, 3600)) > 20) return { error: "rate_limited", values };
  // Order numbers follow each other: without this, one phone could be paired with every number from many IPs.
  if ((await hit(`support-find:phone:${phone}`, 3600)) > SUPPORT_FIND_PER_PHONE) return { error: "rate_limited", values };

  const order = await db.order.findFirst({ where: { number, phone }, select: { id: true, status: true } });
  if (!order) return { error: "not_found", values };
  if (order.status !== "DELIVERED") return { error: "not_delivered", values };
  redirect(`/${locale === "en" ? "en" : "ar"}${supportPath(order.id)}`);
}

/** The customer's delivered order ids for a link (lib/support/customer supportAccess), or null. */
const deliveredOrders = async (token: string) => (await supportAccess(token))?.orderIds ?? null;

export type SendSupportResult = { ok?: boolean; error?: "closed" | "invalid" | "rate_limited" | "too_long_conversation" };

/**
 * A customer message: opens a conversation for the chosen product when none is running, then lets the AI answer.
 * Once handed to the owner, messages are kept for them and the AI stays quiet.
 */
export async function sendSupportMessage(token: string, input: { itemId: string; text: string }): Promise<SendSupportResult> {
  const linkOrder = orderFromSupportToken(token);
  if (!linkOrder) return { error: "closed" };
  const text = String(input.text ?? "").trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) return { error: "invalid" };
  if ((await hit(`support:order:${linkOrder}`, 3600)) > MAX_MESSAGES_PER_HOUR) return { error: "rate_limited" };
  const access = await supportAccess(token);
  if (!access) return { error: "closed" };
  const orderIds = access.orderIds;
  // The AI budget is one pool for the whole shop: one customer gets a daily share, whatever their links or tickets.
  if ((await hit(`support:phone:${access.phone}`, 86400)) > SUPPORT_AI_PER_PHONE_PER_DAY) return { error: "rate_limited" };

  // Any product of any order this customer received; the conversation belongs to that order.
  const item = await db.orderItem.findFirst({
    where: { id: String(input.itemId), orderId: { in: orderIds } },
    select: { id: true, orderId: true, nameAr: true, variantLabel: true, variant: { select: { productId: true } } },
  });
  if (!item) return { error: "closed" };
  const orderId = item.orderId;

  let ticket = await db.supportTicket.findFirst({
    where: { orderId, orderItemId: item.id, status: { in: ["OPEN", "ESCALATED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, _count: { select: { messages: { where: { role: "customer" } } } } },
  });
  if (ticket && ticket._count.messages >= MAX_CUSTOMER_MESSAGES) {
    if (ticket.status === "OPEN") {
      await db.supportTicket.update({ where: { id: ticket.id }, data: { status: "ESCALATED", escalatedAt: new Date(), verdict: "help" } });
      const id = ticket.id;
      after(() => notifySupportEscalated(id));
    }
    return { error: "too_long_conversation" };
  }
  if (!ticket) {
    const created = await db.supportTicket.create({
      data: { orderId, orderItemId: item.id, productId: item.variant?.productId ?? null, productName: [item.nameAr, item.variantLabel].filter(Boolean).join(" · ") },
      select: { id: true, status: true },
    });
    ticket = { ...created, _count: { messages: 0 } };
  }

  await db.supportMessage.create({ data: { ticketId: ticket.id, role: "customer", text } });
  await db.supportTicket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
  if (ticket.status === "ESCALATED") return { ok: true };

  const { escalated } = await runSupportTurn(ticket.id);
  if (escalated) {
    const id = ticket.id;
    after(() => notifySupportEscalated(id));
  }
  return { ok: true };
}

/** The customer says it works now. The AI gets the credit only if the owner never stepped in. */
export async function markSupportSolved(token: string, ticketId: string): Promise<SendSupportResult> {
  const orderIds = await deliveredOrders(token);
  if (!orderIds) return { error: "closed" };
  const ticket = await db.supportTicket.findFirst({
    where: { id: String(ticketId), orderId: { in: orderIds }, status: { in: ["OPEN", "ESCALATED"] } },
    select: { id: true, orderId: true, status: true, messages: { where: { role: { not: "customer" } }, select: { role: true } } },
  });
  if (!ticket) return { error: "closed" };
  const orderId = ticket.orderId;
  const ownerStepped = ticket.messages.some((m) => m.role === "owner");

  await db.$transaction(async (tx) => {
    // One order at a time: two clicks together can never give two coupons.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "SOLVED", solvedByAi: ticket.status === "OPEN" && !ownerStepped, closedAt: new Date(), closedBy: "customer" },
    });
    // The thank-you coupon: once per order, and only after a real conversation (someone answered).
    if (!ticket.messages.length) return;
    const [settings, given] = await Promise.all([
      tx.settings.findUnique({ where: { id: 1 }, select: { supportRewardPercent: true, supportRewardDays: true } }),
      tx.supportTicket.count({ where: { orderId, rewardCode: { not: null } } }),
    ]);
    const percent = settings?.supportRewardPercent ?? 10;
    if (given || percent <= 0) return;
    const code = rewardCode(randomInt);
    await tx.coupon.create({ data: { code, type: "PERCENT", value: Math.min(percent, 90), maxUses: 1, expiresAt: rewardExpiry(settings?.supportRewardDays ?? 30) } });
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { rewardCode: code } });
  });
  return { ok: true };
}
