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
import { MAX_CUSTOMER_MESSAGES, MAX_MESSAGE_LENGTH, MAX_MESSAGES_PER_HOUR, rewardCode, rewardExpiry } from "@/lib/support/rules";

export type FindSupportState = { error?: "invalid" | "not_found" | "not_delivered" | "rate_limited"; values?: { number: string; phone: string } };

/**
 * Order number + phone → the private support page. A customer who has received at least one order gets in, even
 * with the number of a newer order still on its way; a cancelled or undelivered order alone does not open it.
 */
export async function findSupport(locale: string, _prev: FindSupportState, fd: FormData): Promise<FindSupportState> {
  const values = { number: String(fd.get("number") ?? "").slice(0, 20), phone: String(fd.get("phone") ?? "").slice(0, 20) };
  const number = values.number.trim().toUpperCase();
  const phone = normalizeMoroccanPhone(values.phone);
  if (!ORDER_NUMBER.test(number) || !phone) return { error: "invalid", values };
  if ((await hit(`support-find:ip:${await clientIp()}`, 3600)) > 20) return { error: "rate_limited", values };

  const order = await db.order.findFirst({ where: { number, phone }, select: { id: true } });
  if (!order) return { error: "not_found", values };
  const received = await db.order.findFirst({ where: { phone, status: "DELIVERED" }, orderBy: { deliveredAt: "desc" }, select: { id: true } });
  if (!received) return { error: "not_delivered", values };
  redirect(`/${locale === "en" ? "en" : "ar"}${supportPath(received.id)}`);
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
  const orderIds = await deliveredOrders(token);
  if (!orderIds) return { error: "closed" };

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
