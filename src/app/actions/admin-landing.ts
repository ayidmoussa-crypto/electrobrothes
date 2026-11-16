"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { cleanDraft, landingDraftSchema, MIDDLE_SECTIONS, publishProblems, TEMPLATES } from "@/lib/landing";

export type LandingSaveState = { ok?: boolean; message?: string; problems?: string[]; publishedAt?: string | null };

const pageInput = z.object({
  productId: z.string().min(1).max(40),
  template: z.enum(TEMPLATES),
  sections: z.array(z.object({ key: z.enum(MIDDLE_SECTIONS), hidden: z.boolean() })).length(MIDDLE_SECTIONS.length),
  content: landingDraftSchema,
});
export type LandingPageInput = z.infer<typeof pageInput>;

const json = (v: unknown) => v as Prisma.InputJsonValue;

async function saveDraft(input: LandingPageInput, actor: string) {
  const data = { template: input.template, sections: json(input.sections), content: json(input.content), updatedBy: actor };
  await db.landingPage.upsert({ where: { productId: input.productId }, create: { productId: input.productId, ...data }, update: data });
}

/** "حفظ المسودة": nothing changes for shoppers. */
export async function saveLandingDraft(raw: LandingPageInput): Promise<LandingSaveState> {
  const admin = await requireAdmin();
  const { tr } = await adminTr();
  const parsed = pageInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: tr("تحقق من الخانات: شي نص طويل بزاف.", "Check the fields: some text is too long.") };
  await saveDraft(parsed.data, admin.email);
  // The preview reads through the catalog cache.
  updateTag("landing");
  return { ok: true, message: tr("تحفظات المسودة.", "Draft saved.") };
}

/** "نشر": saves the draft, checks it, then makes exactly that version the live page. */
export async function publishLanding(raw: LandingPageInput): Promise<LandingSaveState> {
  const admin = await requireAdmin();
  const { tr, lang } = await adminTr();
  const parsed = pageInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: tr("تحقق من الخانات: شي نص طويل بزاف.", "Check the fields: some text is too long.") };
  await saveDraft(parsed.data, admin.email);
  const problems = publishProblems(parsed.data.content, lang);
  if (problems.length) {
    updateTag("landing");
    return { ok: false, message: tr("تحفظات المسودة، ولكن ما تنشراتش:", "Draft saved, but not published:"), problems };
  }
  const publishedAt = new Date();
  await db.landingPage.update({
    where: { productId: parsed.data.productId },
    data: { published: json({ template: parsed.data.template, sections: parsed.data.sections, content: cleanDraft(parsed.data.content) }), publishedAt },
  });
  updateTag("landing");
  return { ok: true, message: tr("تنشرات الصفحة.", "Page published."), publishedAt: publishedAt.toISOString() };
}

/** "إيقاف النشر": the page answers 404 again; the draft stays. */
export async function unpublishLanding(productId: string): Promise<LandingSaveState> {
  await requireAdmin();
  const { tr } = await adminTr();
  await db.landingPage.updateMany({ where: { productId: String(productId).slice(0, 40) }, data: { published: Prisma.DbNull, publishedAt: null } });
  updateTag("landing");
  return { ok: true, message: tr("توقفات الصفحة.", "Page taken offline."), publishedAt: null };
}
