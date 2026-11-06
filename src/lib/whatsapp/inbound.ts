import "server-only";
import { db } from "../db";
import { nextStatus, type InboundMessage, type StatusUpdate } from "./rules";

/** Meta re-sends webhooks, so a message already stored (same wamid) changes nothing, unread count included. */
export async function storeInbound(m: InboundMessage) {
  await db.$transaction(async (tx) => {
    const conversation = await tx.waConversation.upsert({
      where: { phone: m.phone },
      create: { phone: m.phone, name: m.name, lastMessageAt: m.at },
      update: {},
    });
    const created = await tx.waMessage.createMany({
      data: [{ conversationId: conversation.id, wamid: m.wamid, direction: "IN", type: m.type, body: m.body, createdAt: m.at }],
      skipDuplicates: true,
    });
    if (!created.count) return;
    // A retried older message must not move the conversation back in time.
    const newest = m.at >= conversation.lastMessageAt;
    const inboundNewest = !conversation.lastInboundAt || m.at >= conversation.lastInboundAt;
    await tx.waConversation.update({
      where: { id: conversation.id },
      data: {
        unread: { increment: 1 },
        ...(m.name ? { name: m.name } : {}),
        ...(inboundNewest ? { lastInboundAt: m.at } : {}),
        ...(newest ? { lastMessageAt: m.at, lastPreview: m.body.slice(0, 120) } : {}),
      },
    });
  });
}

export async function storeStatus(s: StatusUpdate) {
  const message = await db.waMessage.findUnique({ where: { wamid: s.wamid }, select: { id: true, status: true } });
  if (!message) return;
  const status = nextStatus(message.status, s.status);
  if (status === message.status && !s.error) return;
  await db.waMessage.update({ where: { id: message.id }, data: { status, ...(s.error ? { error: s.error } : {}) } });
}
