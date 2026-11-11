"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { sendWaTemplate, sendWaText, WaSendError } from "@/lib/whatsapp/client";
import { windowOpen } from "@/lib/whatsapp/rules";

type State = { ok?: boolean; message?: string };

const phone = z.string().regex(/^\+\d{8,15}$/);

const textInput = z.object({ phone, text: z.string().trim().min(1).max(4096) });

export async function sendReply(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const parsed = textInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("اكتب الرسالة.", "Type the message.") };
  const conversation = await db.waConversation.findUnique({ where: { phone: parsed.data.phone }, select: { lastInboundAt: true } });
  // Meta refuses free text outside the window; saying so here is clearer than its error code.
  if (!windowOpen(conversation?.lastInboundAt ?? null)) return { ok: false, message: (await adminTr()).tr("فاتت 24 ساعة من آخر رسالة ديال الزبون: غير القوالب المعتمدة كتتصيفط.", "24 hours have passed since the customer's last message: only approved templates can be sent.") };
  try {
    await sendWaText(parsed.data.phone, parsed.data.text, admin.email);
  } catch (e) {
    if (e instanceof WaSendError) return { ok: false, message: e.message };
    throw e;
  }
  revalidatePath("/admin/inbox");
  return { ok: true };
}

const templateInput = z.object({
  phone,
  name: z.string().trim().regex(/^[a-z0-9_]{1,512}$/),
  language: z.string().trim().regex(/^[a-zA-Z_]{2,8}$/),
  params: z.string().max(2000).optional(),
});

export async function sendTemplate(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const parsed = templateInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("اسم القالب: حروف لاتينية صغيرة وأرقام و_ فقط، كما هو في Meta.", "Template name: lower-case Latin letters, digits and _ only, as in Meta.") };
  const params = (parsed.data.params ?? "").split("\n").map((p) => p.trim()).filter(Boolean);
  try {
    await sendWaTemplate(parsed.data.phone, { name: parsed.data.name, language: parsed.data.language, params }, admin.email);
  } catch (e) {
    if (e instanceof WaSendError) return { ok: false, message: e.message };
    throw e;
  }
  revalidatePath("/admin/inbox");
  return { ok: true, message: (await adminTr()).tr("تم إرسال القالب.", "Template sent.") };
}
