"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
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

const apiMessage = async (e: unknown) => {
  if (e instanceof ExternalSearchError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return (await adminTr()).tr("مفتاح Claude API ما خدامش. تحقق من ANTHROPIC_API_KEY.", "The Claude API key does not work. Check ANTHROPIC_API_KEY.");
  if (e instanceof Anthropic.RateLimitError) return (await adminTr()).tr("Claude مشغول دابا. عاود جرب من بعد شوية.", "Claude is busy right now. Try again in a moment.");
  if (e instanceof Anthropic.APIConnectionError) return (await adminTr()).tr("ما قدرناش نتصلو بـ Claude. عاود جرب.", "Could not reach Claude. Try again.");
  if (e instanceof Anthropic.APIError) return (await adminTr()).tr("وقع مشكل مع Claude. عاود جرب.", "Something went wrong with Claude. Try again.");
  return null;
};

// ───────── Customer reviews ─────────

export async function approveReview(reviewId: string, replyText: string): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ reviewId: id, replyText: reply }).safeParse({ reviewId, replyText });
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("الرد طويل بزاف.", "The reply is too long.") };
  const review = await db.review.update({
    where: { id: parsed.data.reviewId },
    data: { isApproved: true, rejectedAt: null, decidedBy: admin.email, replyText: parsed.data.replyText || null },
    select: { productId: true },
  });
  await refreshProduct(review.productId);
  return { ok: true, message: (await adminTr()).tr("تنشر.", "Published.") };
}

export async function rejectReview(reviewId: string): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(reviewId);
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
  const review = await db.review.update({ where: { id: parsed.data }, data: { isApproved: false, rejectedAt: new Date(), decidedBy: admin.email }, select: { productId: true } });
  await refreshProduct(review.productId);
  return { ok: true, message: (await adminTr()).tr("ترفض.", "Rejected.") };
}

export async function suggestReviewReply(reviewId: string): Promise<ReviewActionState & { reply?: string }> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(reviewId);
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
  try {
    const text = await suggestReply(parsed.data, admin.email);
    revalidatePath("/admin/reviews");
    return text ? { ok: true, reply: text } : { ok: false, message: (await adminTr()).tr("ما قدرناش نقترحو رد مناسب. كتبو بيدك.", "Could not suggest a fitting reply. Write it by hand.") };
  } catch (e) {
    const message = await apiMessage(e);
    if (message) return { ok: false, message };
    throw e;
  }
}

// ───────── Ratings from other websites ─────────

export async function findExternalRatings(productId: string): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(productId);
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
  try {
    const { created, reply } = await searchExternalRatings(parsed.data, admin.email);
    revalidatePath(`/admin/products/${parsed.data}`);
    return { ok: true, message: created ? (await adminTr()).tr(`لقينا ${created} مصدر. حل كل رابط وتأكد أنه نفس الموديل قبل ما تقبل.`, `Found ${created} sources. Open each link and check it is the same model before you accept.`) : (await adminTr()).tr(`ما لقيناش مصدر مؤكد لهاد الموديل. ${reply.slice(0, 300)}`, `No confirmed source found for this model. ${reply.slice(0, 300)}`) };
  } catch (e) {
    const message = await apiMessage(e);
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
  if (!productId.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
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
  if (!fields.success) return { ok: false, message: (await adminTr()).tr("تحقق من الموقع، والرابط (https)، والنقطة.", "Check the site, the link (https) and the rating.") };
  if (fd.get("confirmed") !== "on") return { ok: false, message: (await adminTr()).tr("حل الرابط وتأكد أنه نفس الموديل، وعلم على الخانة.", "Open the link, check it is the same model, and tick the box.") };

  const data = { ...fields.data, status: "APPROVED" as const, lastCheckedAt: new Date(), decidedBy: admin.email, decidedAt: new Date() };
  try {
    if (typeof rawId === "string" && rawId) await db.externalRating.update({ where: { id: rawId, productId: productId.data }, data });
    else await db.externalRating.create({ data: { ...data, productId: productId.data } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: (await adminTr()).tr("هاد الرابط كاين من قبل فهاد المنتج.", "This link is already on this product.") };
    throw e;
  }
  await refreshProduct(productId.data);
  return { ok: true, message: (await adminTr()).tr("تنشر فالمتجر.", "Published in the shop.") };
}

export async function rejectExternalRating(ratingId: string): Promise<ReviewActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(ratingId);
  if (!parsed.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
  const row = await db.externalRating.update({ where: { id: parsed.data }, data: { status: "REJECTED", decidedBy: admin.email, decidedAt: new Date() }, select: { productId: true } });
  await refreshProduct(row.productId);
  return { ok: true, message: (await adminTr()).tr("تحيد.", "Removed.") };
}
