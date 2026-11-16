"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { analyzeCampaigns, CampaignAiError, generateLandingContent, suggestNewOffers, suggestOfferTitles } from "@/lib/assistant/campaigns";
import { HAIKU } from "@/lib/assistant/rules";
import { db } from "@/lib/db";
import { DEFAULT_SECTIONS, normalizeSections, type LandingDraft, type LandingTemplate } from "@/lib/landing";
import { apiErrorMessage } from "@/lib/seo-content/service";

type Fail = { ok: false; message: string };
const id = z.string().min(1).max(40);

async function guard<T>(task: (actor: string) => Promise<T>): Promise<({ ok: true } & T) | Fail> {
  const admin = await requireAdmin();
  const { tr, lang } = await adminTr();
  try {
    return { ok: true, ...(await task(admin.email)) };
  } catch (e) {
    if (e instanceof CampaignAiError) return { ok: false, message: e.message };
    const known = apiErrorMessage(e, lang);
    if (known) return { ok: false, message: known };
    console.error("[campaign-ai]", e);
    return { ok: false, message: tr("وقع مشكل. عاود جرب.", "Something went wrong. Try again.") };
  }
}

/** Three title options for a home offer. Nothing is saved: the owner picks one, then saves the offer. */
export async function aiOfferTitles(productId: string, current: string) {
  return guard(async (actor) => ({ options: await suggestOfferTitles(id.parse(productId), actor, String(current).slice(0, 120)) }));
}

/** Three product ideas for this week's offers, with the product names for the cards. */
export async function aiOfferIdeas() {
  return guard(async (actor) => {
    const ideas = await suggestNewOffers(actor);
    const names = new Map((await db.product.findMany({ where: { id: { in: ideas.map((i) => i.product_id) } }, select: { id: true, nameAr: true } })).map((p) => [p.id, p.nameAr]));
    return { ideas: ideas.map((i) => ({ productId: i.product_id, name: names.get(i.product_id) ?? "", reason: i.reason_ar, titleAr: i.title_ar, sublineAr: i.subline_ar, style: i.style })) };
  });
}

/** What the clicks and orders say, in Darija. */
export async function aiAnalyzeCampaigns() {
  return guard(async (actor) => ({ analysis: await analyzeCampaigns(actor) }));
}

/**
 * "توليد الصفحة كاملة": new texts and the template the rules pick, saved as the page's draft (never published).
 * The section order the owner set is kept.
 */
export async function aiLandingPage(productId: string) {
  return guard(async (actor) => {
    const pid = id.parse(productId);
    const g = await generateLandingContent(pid, actor);
    const existing = await db.landingPage.findUnique({ where: { productId: pid }, select: { sections: true } });
    const sections = existing ? normalizeSections(existing.sections) : DEFAULT_SECTIONS;
    const data = { template: g.template, content: g.content as unknown as Prisma.InputJsonValue, model: g.source === "ai" ? HAIKU : null, updatedBy: actor };
    await db.landingPage.upsert({ where: { productId: pid }, create: { productId: pid, sections: sections as unknown as Prisma.InputJsonValue, ...data }, update: data });
    updateTag("landing");
    return { template: g.template as LandingTemplate, content: g.content, fallback: g.source === "fallback" };
  });
}

/** "إعادة التوليد" for one part: returned only; the owner sees it in the editor and saves when happy. */
export async function aiLandingSection(productId: string, section: "headline" | "features" | "comparison" | "faq") {
  return guard(async (actor) => {
    const g = await generateLandingContent(id.parse(productId), actor);
    const c = g.content;
    const part: Partial<LandingDraft> =
      section === "headline" ? { headline: c.headline, subline: c.subline } : section === "features" ? { features: c.features } : section === "comparison" ? { comparison: c.comparison } : { faq: c.faq };
    return { part, fallback: g.source === "fallback" };
  });
}
