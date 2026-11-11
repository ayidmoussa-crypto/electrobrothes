"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { isParam, TRIGGERS } from "@/lib/automation-rules";
import { db } from "@/lib/db";

type State = { ok?: boolean; message?: string };

const ruleInput = z.object({
  name: z.string().trim().min(2).max(80),
  trigger: z.enum(Object.keys(TRIGGERS) as [keyof typeof TRIGGERS, ...(keyof typeof TRIGGERS)[]]),
  delayMinutes: z.coerce.number().int().min(0).max(60 * 24 * 30),
  templateName: z.string().trim().regex(/^[a-z0-9_]{1,512}$/),
  languageCode: z.string().trim().regex(/^[a-zA-Z_]{2,8}$/),
});

export async function addRule(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const parsed = ruleInput.safeParse(Object.fromEntries([...fd].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("تحقق من الحقول. اسم القالب: حروف لاتينية صغيرة وأرقام و_ فقط.", "Check the fields. Template name: lower-case Latin letters, digits and _ only.") };
  // One select per placeholder, in {{1}}, {{2}}… order; the ones left empty are dropped.
  const params = fd.getAll("param").map(String).filter(isParam);
  await db.automationRule.create({ data: { ...parsed.data, params } });
  revalidatePath("/admin/automations");
  return { ok: true, message: (await adminTr()).tr("تمت إضافة القاعدة، وهي متوقفة حتى تشغّلها.", "Rule added. It stays off until you turn it on.") };
}

export async function toggleRule(fd: FormData) {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(fd.get("id"));
  if (!id.success) return;
  const rule = await db.automationRule.findUnique({ where: { id: id.data }, select: { isActive: true } });
  if (!rule) return;
  await db.automationRule.update({ where: { id: id.data }, data: { isActive: !rule.isActive } });
  revalidatePath("/admin/automations");
}

/**
 * The owner's answer for a job that stopped mid-send, after looking at the conversation:
 * "resend" (it never arrived), "sent" (it did), or "drop" (leave it).
 */
export async function resolveStuckJob(fd: FormData) {
  await requireAdmin();
  const input = z.object({ id: z.string().min(1).max(40), decision: z.enum(["resend", "sent", "drop"]) }).safeParse(Object.fromEntries(fd));
  if (!input.success) return;
  const { id, decision } = input.data;
  const data =
    decision === "resend"
      ? { status: "PENDING" as const, dueAt: new Date(), claimedAt: null, sendStartedAt: null, error: null }
      : decision === "sent"
        ? { status: "SENT" as const, sentAt: new Date(), error: "تأكد باليد" }
        : { status: "SKIPPED" as const, error: "تلغى باليد" };
  await db.automationJob.updateMany({ where: { id, status: "NEEDS_REVIEW" }, data });
  revalidatePath("/admin/automations");
}

export async function deleteRule(fd: FormData) {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(fd.get("id"));
  if (!id.success) return;
  await db.automationRule.delete({ where: { id: id.data } }).catch(() => null);
  revalidatePath("/admin/automations");
}
