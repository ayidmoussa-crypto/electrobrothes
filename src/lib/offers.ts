import { z } from "zod";
import { moroccanDate } from "./time";

// Home page offers (Campaign Studio). Pure: shared by the admin, the store and tests.

export const OFFER_STYLES = ["dark", "light", "features"] as const;
export type OfferStyle = (typeof OFFER_STYLES)[number];

export const OFFER_STYLE_LABEL: Record<OfferStyle, { ar: string; en: string; hintAr: string; hintEn: string }> = {
  dark: { ar: "داكن", en: "Dark", hintAr: "خلفية كحلة، العنوان فالوسط والصورة كبيرة تحتو.", hintEn: "Dark background, centred title, large photo below." },
  light: { ar: "فاتح", en: "Light", hintAr: "خلفية فاتحة دافئة، نفس الترتيب.", hintEn: "Warm light background, same layout." },
  features: { ar: "بطاقة بالمميزات", en: "Feature card", hintAr: "4 مميزات من مواصفات المنتج فوق الصورة.", hintEn: "4 features from the product's specs above the photo." },
};

export const isOfferStyle = (v: unknown): v is OfferStyle => OFFER_STYLES.includes(v as OfferStyle);

/** Shown on the shop only while published and between its dates. */
export function isLive(o: { isPublished: boolean; startsAt: Date | null; endsAt: Date | null }, now: number) {
  return o.isPublished && (!o.startsAt || o.startsAt.getTime() <= now) && (!o.endsAt || o.endsAt.getTime() > now);
}

/** Where "تسوّق الآن" goes: the offer page when asked for and published, else the product page. */
export const offerHref = (o: { link: string }, slug: string, pagePublished: boolean) => (o.link === "page" && pagePublished ? `/offers/${slug}` : `/products/${slug}`);

/** A photo the shop may show: its own Cloudinary files or its own /public files. Anything else is refused. */
export const isShopImage = (url: string) => /^https:\/\/res\.cloudinary\.com\//.test(url) || /^\/[\w./-]+$/.test(url);

// Typed in the admin in Moroccan time ("YYYY-MM-DDTHH:mm"), see lib/time.ts.
const optionalDate = z.preprocess((v) => (typeof v === "string" && v ? moroccanDate(v) : null), z.date().nullable());

export const offerInput = z
  .object({
    id: z.string().max(40).optional().transform((v) => v || undefined),
    name: z.string().trim().min(2).max(80),
    productId: z.string().min(1).max(40),
    style: z.enum(OFFER_STYLES),
    titleAr: z.string().trim().min(2).max(80),
    titleEn: z.string().trim().max(80).default(""),
    sublineAr: z.string().trim().max(160).default(""),
    sublineEn: z.string().trim().max(160).default(""),
    image: z
      .string()
      .trim()
      .max(500)
      .default("")
      .refine((v) => !v || isShopImage(v), "image")
      .transform((v) => v || null),
    link: z.enum(["product", "page"]),
    startsAt: optionalDate,
    endsAt: optionalDate,
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((o) => !o.startsAt || !o.endsAt || o.startsAt < o.endsAt, { message: "dates", path: ["endsAt"] });
export type OfferInput = z.infer<typeof offerInput>;

// ───────── Click events ─────────

export const CAMPAIGN_EVENTS = ["hero_cta_click", "whatsapp_click", "order_form_submit"] as const;
export type CampaignEventType = (typeof CAMPAIGN_EVENTS)[number];

export const campaignEventInput = z.object({
  type: z.enum(CAMPAIGN_EVENTS),
  source: z.enum(["home", "page"]),
  offerId: z.string().max(40).nullish(),
  productId: z.string().max(40).nullish(),
  template: z.string().max(40).nullish(),
});
export type CampaignEventInput = z.infer<typeof campaignEventInput>;

/** Cookie naming the home offer last clicked, read when the order is placed (7 days, no personal data). */
export const OFFER_COOKIE = "eb_offer";
export const OFFER_COOKIE_DAYS = 7;

/**
 * Where an order stands for the studio's figures: still waiting, confirmed (and on its way), delivered (the main
 * success), refused or sent back, or cancelled before shipping.
 */
export function orderBucket(status: string): "waiting" | "confirmed" | "delivered" | "refused" | "cancelled" {
  if (status === "NEW") return "waiting";
  if (status === "DELIVERED") return "delivered";
  if (status === "RETURNING" || status === "RETURNED") return "refused";
  if (status === "CANCELLED") return "cancelled";
  return "confirmed";
}

/** Clicks and orders → the rates the studio shows. Orders counted are the ones that came from this offer or page. */
export function campaignRates(c: { clicks: number; orders: number; confirmed: number; delivered: number; refused: number }) {
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  return { orderRate: pct(c.orders, c.clicks), confirmRate: pct(c.confirmed, c.orders), deliveryRate: pct(c.delivered, c.orders), refusalRate: pct(c.refused, c.orders) };
}
