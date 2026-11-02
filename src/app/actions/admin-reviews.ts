"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { suggestReply } from "@/lib/reviews/customer";
import { ExternalSearchError, searchExternalRatings } from "@/lib/reviews/external";
import { externalRatingInput } from "@/lib/reviews/rules";

export type ReviewActionState = { ok?: boolean; message?: string };

const id = z.string().min(1).max(40);
const reply = z.string().trim().max(1000);

async function refreshProduct(productId: string) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { slug: true } });
  // updateTag: the next storefront visit already shows the change.
  updateTag("products");
  if (product) updateTag(`product:${product.slug}`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/reviews");
}

const apiMessage = (e: unknown) => {
  if (e instanceof ExternalSearchError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "مفتاح Claude API ما خدامش. تحقق من ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.RateLimitError) return "Claude مشغول دابا. عاود جرب من بعد شوية.";
  if (e instanceof Anthropic.APIConnectionError) return "ما قدرناش نتصلو بـ Claude. عاود جرب.";
  if (e instanceof Anthropic.APIError) return "وقع مشكل مع Claude. عاود جرب.";
  return null;
};

// ───────── Customer reviews ─────────

export async function approveReview(reviewId: string, replyText: string): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ reviewId: id, replyText: reply }).safeParse({ reviewId, replyText });
  if (!parsed.success) return { ok: false, message: "الرد طويل بزاف." };
  const review = await db.review.update({
    where: { id: parsed.data.reviewId },
    data: { isApproved: true, rejectedAt: null, decidedBy: admin.email, replyText: parsed.data.replyText || null },
    select: { productId: true },
  });
  await refreshProduct(review.productId);
  return { ok: true, message: "تنشر." };
}

export async function rejectReview(reviewId: string): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(reviewId);
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  const review = await db.review.update({ where: { id: parsed.data }, data: { isApproved: false, rejectedAt: new Date(), decidedBy: admin.email }, select: { productId: true } });
  await refreshProduct(review.productId);
  return { ok: true, message: "ترفض." };
}

export async function suggestReviewReply(reviewId: string): Promise<ReviewActionState & { reply?: string }> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(reviewId);
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  try {
    const text = await suggestReply(parsed.data, admin.email);
    revalidatePath("/admin/reviews");
    return text ? { ok: true, reply: text } : { ok: false, message: "ما قدرناش نقترحو رد مناسب. كتبو بيدك." };
  } catch (e) {
    const message = apiMessage(e);
    if (message) return { ok: false, message };
    throw e;
  }
}

// ───────── Ratings from other websites ─────────

export async function findExternalRatings(productId: string): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(productId);
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  try {
    const { created, reply } = await searchExternalRatings(parsed.data, admin.email);
    revalidatePath(`/admin/products/${parsed.data}`);
    return { ok: true, message: created ? `لقينا ${created} مصدر. حل كل رابط وتأكد أنه نفس الموديل قبل ما تقبل.` : `ما لقيناش مصدر مؤكد لهاد الموديل. ${reply.slice(0, 300)}` };
  } catch (e) {
    const message = apiMessage(e);
    if (message) return { ok: false, message };
    throw e;
  }
}

/**
 * Saves a source from the owner's form. Publishing needs the "I opened it" box ticked: that click,
 * and nothing else, is what puts an external rating on the store.
 */
export async function saveExternalRating(_: ReviewActionState, fd: FormData): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const productId = id.safeParse(fd.get("productId"));
  if (!productId.success) return { ok: false, message: "طلب غير صالح." };
  const rawId = fd.get("id");
  const fields = externalRatingInput.safeParse({
    source: fd.get("source"),
    url: fd.get("url"),
    rating: fd.get("rating"),
    ratingMax: fd.get("ratingMax"),
    ratingCount: fd.get("ratingCount"),
    summaryAr: fd.get("summaryAr"),
    summaryEn: fd.get("summaryEn"),
  });
  if (!fields.success) return { ok: false, message: "تحقق من الموقع، والرابط (https)، والنقطة." };
  if (fd.get("confirmed") !== "on") return { ok: false, message: "حل الرابط وتأكد أنه نفس الموديل، وعلم على الخانة." };

  const data = { ...fields.data, status: "APPROVED" as const, lastCheckedAt: new Date(), decidedBy: admin.email, decidedAt: new Date() };
  try {
    if (typeof rawId === "string" && rawId) await db.externalRating.update({ where: { id: rawId, productId: productId.data }, data });
    else await db.externalRating.create({ data: { ...data, productId: productId.data } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: "هاد الرابط كاين من قبل فهاد المنتج." };
    throw e;
  }
  await refreshProduct(productId.data);
  return { ok: true, message: "تنشر فالمتجر." };
}

export async function rejectExternalRating(ratingId: string): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(ratingId);
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };
  const row = await db.externalRating.update({ where: { id: parsed.data }, data: { status: "REJECTED", decidedBy: admin.email, decidedAt: new Date() }, select: { productId: true } });
  await refreshProduct(row.productId);
  return { ok: true, message: "تحيد." };
}
