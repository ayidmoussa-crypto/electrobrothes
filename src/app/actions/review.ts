"use server";

import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { sniffImage } from "@/lib/assistant/rules";
import { uploadImage } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { clientIp, hit } from "@/lib/guard";
import { notifyNegativeReview } from "@/lib/notify";
import { suggestReply } from "@/lib/reviews/customer";
import { isNegativeReview, publicAuthorName, readReviewToken, reviewInput } from "@/lib/reviews/rules";

export type ReviewFormState = { ok?: boolean; error?: "invalid" | "closed" | "tooMany" | "already" | "photo" };

const MAX_PHOTO_BYTES = 900_000;
const MAX_PER_HOUR = 20;

/** A customer's review from their private link. It stays hidden until the owner approves it. */
export async function submitReview(token: string, itemId: string, locale: string, _: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  const secret = process.env.SESSION_SECRET ?? "";
  const orderId = readReviewToken(token, secret);
  if (!orderId) return { error: "closed" };
  if ((await hit(`review:${await clientIp()}`, 3600)) > MAX_PER_HOUR) return { error: "tooMany" };

  const parsed = reviewInput.safeParse({ rating: fd.get("rating"), comment: fd.get("comment") });
  if (!parsed.success) return { error: "invalid" };

  const item = await db.orderItem.findFirst({
    where: { id: itemId, orderId, order: { status: "DELIVERED" } },
    select: { id: true, variant: { select: { productId: true } }, order: { select: { customerName: true, cityName: true } } },
  });
  if (!item?.variant) return { error: "closed" };

  let photoUrl: string | null = null;
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) return { error: "photo" };
    const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
    const type = sniffImage(base64);
    if (!type) return { error: "photo" };
    photoUrl = await uploadImage(base64, "electrobrothers/reviews", type);
  }

  let reviewId: string;
  try {
    const review = await db.review.create({
      data: {
        productId: item.variant.productId,
        orderItemId: item.id,
        verified: true,
        // Hidden until the owner approves it, whatever the column's default.
        isApproved: false,
        authorName: publicAuthorName(item.order.customerName),
        city: item.order.cityName,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        photoUrl,
        locale: locale === "en" ? "en" : "ar",
      },
      select: { id: true },
    });
    reviewId = review.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "already" };
    throw e;
  }

  // After the response: a slow model or mail server never delays the customer.
  const negative = isNegativeReview(parsed.data.rating);
  after(async () => {
    await suggestReply(reviewId, "review-reply").catch((e) => console.error("review reply failed", e instanceof Error ? e.message : e));
    if (negative) await notifyNegativeReview(reviewId);
  });
  return { ok: true };
}
