import "server-only";
import { db } from "./db";
import { RETRY_LIMIT, RETRY_MINUTES, templateValues, triggerStillValid, type ParamKey, type Trigger } from "./automation-rules";
import type { OrderStatus } from "./order-rules";
import { reviewLink } from "./reviews/customer";
import { sendWaTemplate, waConfig, WaSendError } from "./whatsapp/client";

/** Queues the active rules for this event. Never throws: a messaging problem must not stop an order changing status. */
export async function fireOrderEvent(orderId: string, trigger: Trigger) {
  try {
    const rules = await db.automationRule.findMany({ where: { trigger, isActive: true }, select: { id: true, delayMinutes: true } });
    if (!rules.length) return;
    const now = Date.now();
    await db.automationJob.createMany({
      data: rules.map((r) => ({ ruleId: r.id, orderId, dueAt: new Date(now + r.delayMinutes * 60_000) })),
      skipDuplicates: true,
    });
  } catch (e) {
    console.error("[automations] could not queue", trigger, e);
  }
}

/** Sends what is due. Each job is claimed first, so two runs at once can never message a customer twice. */
export async function runDueAutomations(limit = 25) {
  const result = { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  if (!waConfig()) return result; // Stays queued until WhatsApp is connected.

  const due = await db.automationJob.findMany({
    where: { status: "PENDING", dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: limit,
    include: { rule: true },
  });

  for (const job of due) {
    const claimed = await db.automationJob.updateMany({ where: { id: job.id, status: "PENDING" }, data: { status: "SENDING", attempts: { increment: 1 } } });
    if (!claimed.count) continue;

    const finish = (status: "SENT" | "SKIPPED" | "FAILED", error?: string) =>
      db.automationJob.update({ where: { id: job.id }, data: { status, error: error?.slice(0, 300) ?? null, sentAt: status === "SENT" ? new Date() : null } });

    const order = await db.order.findUnique({ where: { id: job.orderId }, include: { items: { select: { nameAr: true } } } });
    if (!order) {
      await finish("SKIPPED", "الطلب غير موجود");
      result.skipped++;
      continue;
    }
    if (!job.rule.isActive) {
      await finish("SKIPPED", "القاعدة متوقفة");
      result.skipped++;
      continue;
    }
    if (!triggerStillValid(job.rule.trigger, order.status as OrderStatus)) {
      await finish("SKIPPED", "الطلب تبدلت حالتو");
      result.skipped++;
      continue;
    }
    const values: Record<ParamKey, string | null> = {
      name: order.customerName,
      number: order.number,
      total: `${order.total} درهم`,
      products: order.items.map((i) => i.nameAr).join("، "),
      city: order.cityName,
      address: order.address,
      tracking: order.trackingNumber,
      review_link: reviewLink(order.id),
    };
    const params = templateValues(job.rule.params, values);
    if (!params) {
      // Usually the tracking number, typed in just after the order moved to shipping: give it time.
      const error = "قيمة ناقصة فالقالب (مثلاً رقم التتبع)";
      if (job.attempts + 1 < RETRY_LIMIT) {
        await db.automationJob.update({ where: { id: job.id }, data: { status: "PENDING", error, dueAt: new Date(Date.now() + RETRY_MINUTES * 60_000) } });
        result.waiting++;
      } else {
        await finish("SKIPPED", error);
        result.skipped++;
      }
      continue;
    }

    try {
      await sendWaTemplate(order.phone, { name: job.rule.templateName, language: job.rule.languageCode, params }, "automation", order.customerName);
      await finish("SENT");
      result.sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "خطأ";
      if (e instanceof WaSendError && e.retryable && job.attempts + 1 < RETRY_LIMIT) {
        await db.automationJob.update({ where: { id: job.id }, data: { status: "PENDING", error: message.slice(0, 300), dueAt: new Date(Date.now() + RETRY_MINUTES * 60_000) } });
        result.waiting++;
      } else {
        await finish("FAILED", message);
        result.failed++;
      }
    }
  }
  return result;
}
