import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Pure rules of ratings and reviews (no database, no network), so they can be tested directly.

/** A rating of 1 or 2 stars: the owner is warned, so they can call the customer. */
export const isNegativeReview = (rating: number) => rating <= 2;

export const reviewInput = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(1000),
});

/** First name only on the public page: the full name stays in the order. */
export const publicAuthorName = (customerName: string) => customerName.trim().split(/\s+/)[0] || customerName.trim();

// ───────── The private review link ─────────

const sign = (orderId: string, secret: string) => createHmac("sha256", secret).update(`review:${orderId}`).digest("base64url").slice(0, 32);

/** "<orderId>-<signature>": one link per order, which cannot be guessed from an order number. */
export const reviewToken = (orderId: string, secret: string) => `${orderId}-${sign(orderId, secret)}`;

/** The order id when the link is authentic, or null. */
export function readReviewToken(token: string, secret: string) {
  const dash = token.indexOf("-");
  if (dash < 1) return null;
  const orderId = token.slice(0, dash);
  const given = Buffer.from(token.slice(dash + 1));
  const expected = Buffer.from(sign(orderId, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? orderId : null;
}

export const reviewWhatsappMessage = (customerName: string, orderNumber: string, link: string) =>
  `السلام عليكم ${publicAuthorName(customerName)}، معك ElectroBrothers. نتمنى يكون طلبك ${orderNumber} عجبك. واش تقدر تعطينا رأيك فالمنتج من هنا؟\n${link}`;

// ───────── Ratings from other websites ─────────

const STALE_MONTHS = 3;

/** True once the last check is more than 3 months old. */
export function isStaleRating(lastCheckedAt: Date, now = new Date()) {
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() - STALE_MONTHS);
  return lastCheckedAt < limit;
}

/** "4.6" on the usual five-star scale; other scales say so: "8.4/10". */
export const formatRating = (rating: number, max: number) => (max === 5 ? rating.toFixed(1) : `${Number(rating.toFixed(1))}/${max}`);

export const formatCount = (count: number) => new Intl.NumberFormat("en-US").format(count);

const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((u) => {
    try {
      return new URL(u).protocol === "https:";
    } catch {
      return false;
    }
  }, "url");

const optionalSummary = z.preprocess((v) => (typeof v === "string" && !v.trim() ? null : v), z.string().trim().max(300).nullable());

export const externalRatingInput = z
  .object({
    source: z.string().trim().min(2).max(60),
    url: httpsUrl,
    rating: z.coerce.number().min(0),
    ratingMax: z.coerce.number().refine((m) => [5, 10, 100].includes(m), "ratingMax"),
    ratingCount: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(100_000_000).nullable()),
    summaryAr: optionalSummary,
    summaryEn: optionalSummary,
  })
  .refine((r) => r.rating <= r.ratingMax, { message: "rating", path: ["rating"] });

/** Same page, whatever the tracking parameters or trailing slash. */
export function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|tag$|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
    u.pathname = u.pathname.replace(/\/+$/, "");
    return u.href.replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** The addresses present in search and fetch results. A proposal must link to one of them. */
export const urlsInText = (text: string) => (text.match(/https:\/\/[^\s"'<>\\)\]]+/g) ?? []).map(normalizeUrl);
