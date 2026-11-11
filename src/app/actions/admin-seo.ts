"use server";

import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
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
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
  try {
    refresh(await task(parsed.data, admin.email));
    return { ok: true, message: success };
  } catch (e) {
    const message = apiErrorMessage(e, (await adminTr()).lang);
    if (message) return { ok: false, message };
    throw e;
  }
}

export const acceptSeoSuggestion = async (suggestionId: string) => decide(suggestionId, (i, a) => acceptSuggestion(i, a), (await adminTr()).tr("تطبق.", "Applied."));
export const rejectSeoSuggestion = async (suggestionId: string) => decide(suggestionId, rejectSuggestion, (await adminTr()).tr("ترفض.", "Rejected."));
export const undoSeoSuggestion = async (suggestionId: string) => decide(suggestionId, undoSuggestion, (await adminTr()).tr("رجعات القيمة القديمة.", "The old value is back."));

export async function generateSeoSuggestions(productId: string): Promise<SeoActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(productId);
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
  try {
    const { created, dropped, autoApplied, slugs } = await generateSuggestions(parsed.data, { actor: admin.email, origin: await siteOrigin() });
    refresh(slugs.length ? slugs : undefined);
    const skipped = dropped.length ? (await adminTr()).tr(` ما تطبقش: ${dropped.join("؛ ")}.`, ` Not applied: ${dropped.join("; ")}.`) : "";
    const waiting = created.length - autoApplied;
    return { ok: true, message: created.length ? (await adminTr()).tr(`تطبقو ${autoApplied}، وكيتسناو موافقتك ${waiting}.${skipped}`, `${autoApplied} applied, ${waiting} waiting for your approval.${skipped}`) : (await adminTr()).tr(`ما كاين حتى تحسين جديد.${skipped}`, `No new improvement.${skipped}`) };
  } catch (e) {
    const message = apiErrorMessage(e, (await adminTr()).lang);
    if (message) return { ok: false, message };
    throw e;
  }
}

export async function acceptAllSeoSuggestions(productId: string): Promise<SeoActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(productId);
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
  const { accepted, failed, slugs } = await acceptAllSuggestions(parsed.data, admin.email);
  refresh(slugs.length ? slugs : undefined);
  return { ok: !failed, message: failed ? (await adminTr()).tr(`تقبلو ${accepted}، و${failed} تبدلو من بعد الاقتراح وما تطبقوش.`, `${accepted} accepted; ${failed} changed after the suggestion and were not applied.`) : (await adminTr()).tr(`تقبلو ${accepted}.`, `${accepted} accepted.`) };
}

export async function loadSeoDetail(productId: string) {
  await requireAdmin();
  const parsed = id.safeParse(productId);
  return parsed.success ? seoProductDetail(parsed.data, (await adminTr()).lang) : null;
}

export async function runSiteChecks() {
  await requireAdmin();
  return siteChecks(await siteOrigin(), (await adminTr()).lang);
}

const keyword = z.string().trim().max(80);

export async function saveSeoKeywords(productId: string, ar: string, en: string): Promise<SeoActionState> {
  await requireAdmin();
  const parsed = z.object({ productId: id, ar: keyword, en: keyword }).safeParse({ productId, ar, en });
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("الكلمة المفتاحية طويلة بزاف.", "The keyword is too long.") };
  await saveFocusKeywords(parsed.data.productId, parsed.data);
  refresh();
  return { ok: true, message: (await adminTr()).tr("تسجلات.", "Saved.") };
}

export async function runSeoJobNow(_: SeoActionState, fd: FormData): Promise<SeoActionState> {
  const admin = await requireAdmin();
  const limit = z.coerce.number().int().min(1).max(20).safeParse(fd.get("limit"));
  if (!limit.success) return { ok: false, message: (await adminTr()).tr("عدد المنتجات خاصو يكون بين 1 و20.", "The number of products must be between 1 and 20.") };
  const result = await runSeoJob({ trigger: "manual", limit: limit.data, origin: await siteOrigin(), actor: admin.email });
  if (result.alreadyRunning) return { ok: false, message: (await adminTr()).tr("المهمة خدامة دابا. تسنى حتى تسالي.", "The job is already running. Wait until it ends.") };
  refresh(result.slugs.length ? result.slugs : undefined);
  const { tr } = await adminTr();
  const stop = { budget: tr(" توقفات: وصلنا للسقف الشهري.", " Stopped: the monthly cap was reached."), deadline: tr(" توقفات: سالا الوقت.", " Stopped: out of time."), api_key: tr(" توقفات: مفتاح Claude API ما خدامش.", " Stopped: the Claude API key does not work.") }[result.stoppedBy ?? ""] ?? "";
  return { ok: !result.stoppedBy, message: (await adminTr()).tr(`تولد لـ ${result.generated} منتج: تطبقو ${result.autoApplied}، كيتسناو ${result.suggestions - result.autoApplied}، فشل ${result.failed}.${stop}`, `Generated for ${result.generated} products: ${result.autoApplied} applied, ${result.suggestions - result.autoApplied} waiting, ${result.failed} failed.${stop}`) };
}
