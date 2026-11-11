"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { decryptCredentials, encryptCredentials, mergeCredentials, newWebhookToken } from "@/lib/carrier/secrets";
import { buildStatusMap, statusKey } from "@/lib/carrier/webhook";
import { db } from "@/lib/db";

type State = { ok?: boolean; message?: string };

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null)
  .refine((v) => v === null || /^https:\/\/[^\s]+$/.test(v), "url");
// "data.status": letters, digits, _ and dots only.
const field = z.string().trim().max(80).regex(/^[A-Za-z0-9_.]*$/, "field");

const carrierInput = z.object({
  id: z.string().max(40).optional().transform((v) => v || undefined),
  name: z.string().trim().min(2).max(60),
  logoUrl: optionalUrl,
  trackingUrl: optionalUrl,
  apiBaseUrl: optionalUrl,
  apiKey: z.string().max(500).optional(),
  login: z.string().max(200).optional(),
  password: z.string().max(200).optional(),
  trackingField: field.min(1),
  statusField: field.min(1),
  noteField: field.transform((v) => v || null),
  isActive: z.preprocess((v) => v === "on", z.boolean()),
  isDefault: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveCarrier(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const { tr } = await adminTr();
  const parsed = carrierInput.safeParse(Object.fromEntries([...fd].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return {
      ok: false,
      message:
        issue === "url"
          ? tr("الروابط خاصهم يبداو بـ https://", "Links must start with https://")
          : issue === "field"
            ? tr("أسماء الخانات: حروف لاتينية وأرقام و_ والنقطة فقط (مثال: data.status).", "Field names: Latin letters, digits, _ and dots only (e.g. data.status).")
            : tr("تحقق من الاسم والخانات.", "Check the name and the fields."),
    };
  }
  const { id, apiKey, login, password, ...data } = parsed.data;
  const from = fd.getAll("mapFrom").map(String);
  const to = fd.getAll("mapTo").map(String);
  const statusMap = buildStatusMap(from.map((f, i) => ({ from: f, to: to[i] ?? "" })));

  const existing = id ? await db.carrier.findUnique({ where: { id }, select: { credentials: true, unknownStatuses: true } }) : null;
  if (id && !existing) return { ok: false, message: tr("هاد الشركة ما بقاتش.", "This company no longer exists.") };
  const merged = mergeCredentials(decryptCredentials(existing?.credentials), { apiKey, login, password });
  const credentials = merged.apiKey || merged.login || merged.password ? encryptCredentials(merged) : null;
  // A status the owner has just mapped no longer waits in the "not mapped yet" list.
  const unknownStatuses = (existing?.unknownStatuses ?? []).filter((s) => !(statusKey(s) in statusMap));

  await db.$transaction(async (tx) => {
    if (data.isDefault) await tx.carrier.updateMany({ where: { isDefault: true, ...(id ? { id: { not: id } } : {}) }, data: { isDefault: false } });
    if (id) await tx.carrier.update({ where: { id }, data: { ...data, credentials, statusMap, unknownStatuses } });
    else await tx.carrier.create({ data: { ...data, credentials, statusMap, webhookToken: newWebhookToken(), unknownStatuses: [] } });
  });
  revalidatePath("/admin/carriers");
  revalidatePath("/admin/orders", "layout");
  return { ok: true, message: tr("تسجلات الشركة.", "Company saved.") };
}

export async function deleteCarrier(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const { tr } = await adminTr();
  const id = z.string().min(1).max(40).safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: tr("طلب غير صالح.", "Invalid request.") };
  // Orders keep the company's id as text; their tracking numbers and history stay.
  await db.carrier.delete({ where: { id: id.data } }).catch(() => null);
  revalidatePath("/admin/carriers");
  return { ok: true, message: tr("تحيدات الشركة.", "Company removed.") };
}

/** A new address for the company's updates: the old one stops working at once. */
export async function renewWebhook(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const { tr } = await adminTr();
  const id = z.string().min(1).max(40).safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: tr("طلب غير صالح.", "Invalid request.") };
  await db.carrier.update({ where: { id: id.data }, data: { webhookToken: newWebhookToken() } });
  revalidatePath("/admin/carriers");
  return { ok: true, message: tr("تبدل الرابط. عطي الجديد للشركة.", "Link replaced. Give the new one to the company.") };
}
