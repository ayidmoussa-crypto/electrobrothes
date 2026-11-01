"use server";

import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { runSeoJob } from "@/lib/seo-content/job";
import { siteChecks } from "@/lib/seo-content/score";
import { acceptAllSuggestions, acceptSuggestion, apiErrorMessage, generateSuggestions, rejectSuggestion, saveFocusKeywords, seoProductDetail, undoSuggestion } from "@/lib/seo-content/service";

export type SeoActionState = { ok?: boolean; message?: string };

const id = z.string().min(1).max(40);

async function siteOrigin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

function refresh(slugs: string[] | void) {
  if (slugs) {
    // updateTag: the next storefront visit already shows the change.
    updateTag("products");
    for (const slug of slugs) updateTag(`product:${slug}`);
  }
  revalidatePath("/admin/products", "layout");
  revalidatePath("/admin/seo");
}

async function decide(raw: unknown, task: (id: string, admin: string) => Promise<string[] | void>, success: string): Promise<SeoActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  try {
    refresh(await task(parsed.data, admin.email));
    return { ok: true, message: success };
  } catch (e) {
    const message = apiErrorMessage(e);
    if (message) return { ok: false, message };
    throw e;
  }
}

export const acceptSeoSuggestion = async (suggestionId: string) => decide(suggestionId, (i, a) => acceptSuggestion(i, a), "تطبق.");
export const rejectSeoSuggestion = async (suggestionId: string) => decide(suggestionId, rejectSuggestion, "ترفض.");
export const undoSeoSuggestion = async (suggestionId: string) => decide(suggestionId, undoSuggestion, "رجعات القيمة القديمة.");

export async function generateSeoSuggestions(productId: string): Promise<SeoActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(productId);
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  try {
    const { created, dropped, autoApplied, slugs } = await generateSuggestions(parsed.data, { actor: admin.email, origin: await siteOrigin() });
    refresh(slugs.length ? slugs : undefined);
    const skipped = dropped.length ? ` ما تطبقش: ${dropped.join("؛ ")}.` : "";
    const waiting = created.length - autoApplied;
    return { ok: true, message: created.length ? `تطبقو ${autoApplied}، وكيتسناو موافقتك ${waiting}.${skipped}` : `ما كاين حتى تحسين جديد.${skipped}` };
  } catch (e) {
    const message = apiErrorMessage(e);
    if (message) return { ok: false, message };
    throw e;
  }
}

export async function acceptAllSeoSuggestions(productId: string): Promise<SeoActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(productId);
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  const { accepted, failed, slugs } = await acceptAllSuggestions(parsed.data, admin.email);
  refresh(slugs.length ? slugs : undefined);
  return { ok: !failed, message: failed ? `تقبلو ${accepted}، و${failed} تبدلو من بعد الاقتراح وما تطبقوش.` : `تقبلو ${accepted}.` };
}

export async function loadSeoDetail(productId: string) {
  await requireAdmin();
  const parsed = id.safeParse(productId);
  return parsed.success ? seoProductDetail(parsed.data) : null;
}

export async function runSiteChecks() {
  await requireAdmin();
  return siteChecks(await siteOrigin());
}

const keyword = z.string().trim().max(80);

export async function saveSeoKeywords(productId: string, ar: string, en: string): Promise<SeoActionState> {
  await requireAdmin();
  const parsed = z.object({ productId: id, ar: keyword, en: keyword }).safeParse({ productId, ar, en });
  if (!parsed.success) return { ok: false, message: "الكلمة المفتاحية طويلة بزاف." };
  await saveFocusKeywords(parsed.data.productId, parsed.data);
  refresh();
  return { ok: true, message: "تسجلات." };
}

export async function runSeoJobNow(_: SeoActionState, fd: FormData): Promise<SeoActionState> {
  const admin = await requireAdmin();
  const limit = z.coerce.number().int().min(1).max(20).safeParse(fd.get("limit"));
  if (!limit.success) return { ok: false, message: "عدد المنتجات خاصو يكون بين 1 و20." };
  const result = await runSeoJob({ trigger: "manual", limit: limit.data, origin: await siteOrigin(), actor: admin.email });
  if (result.alreadyRunning) return { ok: false, message: "المهمة خدامة دابا. تسنى حتى تسالي." };
  refresh(result.slugs.length ? result.slugs : undefined);
  const stop = { budget: " توقفات: وصلنا للسقف الشهري.", deadline: " توقفات: سالا الوقت.", api_key: " توقفات: مفتاح Claude API ما خدامش." }[result.stoppedBy ?? ""] ?? "";
  return { ok: !result.stoppedBy, message: `تولد لـ ${result.generated} منتج: تطبقو ${result.autoApplied}، كيتسناو ${result.suggestions - result.autoApplied}، فشل ${result.failed}.${stop}` };
}
