import "server-only";
import { db } from "./db";
import { RETRY_LIMIT, RETRY_MINUTES, STUCK_MINUTES, stuckJobOutcome, templateValues, triggerStillValid, type ParamKey, type Trigger } from "./automation-rules";
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

/**
 * Jobs left in SENDING by a server that stopped mid-send. Sent again only when it is certain the call to
 * Meta never started; otherwise marked SENT (the message is in the inbox) or NEEDS_REVIEW for the owner.
 */
export async function recoverStuckJobs() {
  const now = new Date();
  const stuck = await db.automationJob.findMany({
    where: { status: "SENDING", OR: [{ claimedAt: { lt: new Date(now.getTime() - STUCK_MINUTES * 60_000) } }, { claimedAt: null }] },
    include: { rule: { select: { templateName: true } } },
    take: 50,
  });
  const out = { retried: 0, sent: 0, review: 0 };
  for (const job of stuck) {
    const since = job.sendStartedAt ?? job.claimedAt;
    const order = await db.order.findUnique({ where: { id: job.orderId }, select: { phone: true } });
    const recorded =
      !!order &&
      !!since &&
      (await db.waMessage.count({
        where: { direction: "OUT", actor: "automation", templateName: job.rule.templateName, conversation: { phone: order.phone }, createdAt: { gte: since } },
      })) > 0;
    const outcome = stuckJobOutcome(job, now, recorded);
    if (outcome === "wait") continue;
    // Only from SENDING: a run that finished it in the meantime wins.
    const where = { id: job.id, status: "SENDING" as const };
    if (outcome === "retry") {
      const r = await db.automationJob.updateMany({ where, data: { status: "PENDING", claimedAt: null, dueAt: now, error: "توقف قبل الإرسال، تعاود" } });
      out.retried += r.count;
    } else if (outcome === "sent") {
      const r = await db.automationJob.updateMany({ where, data: { status: "SENT", sentAt: since, error: null } });
      out.sent += r.count;
    } else {
      const r = await db.automationJob.updateMany({ where, data: { status: "NEEDS_REVIEW", error: "توقف أثناء الإرسال: تأكد فالمحادثة واش وصلات" } });
      out.review += r.count;
    }
  }
  if (out.retried || out.sent || out.review) console.warn("[automations] recovered stuck jobs", out);
  return out;
}

/** Sends what is due. Each job is claimed first, so two runs at once can never message a customer twice. */
export async function runDueAutomations(limit = 25) {
  const result = { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  if (!waConfig()) return result; // Stays queued until WhatsApp is connected.

  // A crash must never hide a job forever; and a failure here never stops the due ones going out.
  await recoverStuckJobs().catch((e) => console.error("[automations] could not check stuck jobs", e));

  const due = await db.automationJob.findMany({
    where: { status: "PENDING", dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: limit,
    include: { rule: true },
  });

  for (const job of due) {
    const claimed = await db.automationJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "SENDING", attempts: { increment: 1 }, claimedAt: new Date(), sendStartedAt: null },
    });
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
      // Saved before the call: from here on a crash can't prove the message didn't go out.
      await db.automationJob.update({ where: { id: job.id }, data: { sendStartedAt: new Date() } });
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
