// An order the owner types in from a WhatsApp, phone or social conversation. Pure validation and totals:
// unlike the shop's checkout, the owner may agree a price, a discount or the delivery fee with the customer.
import { z } from "zod";
import { normalizeMoroccanPhone } from "./phone";

export const MANUAL_SOURCES = {
  WHATSAPP: "واتساب",
  PHONE: "مكالمة",
  INSTAGRAM: "إنستغرام",
  FACEBOOK: "فيسبوك",
  TIKTOK: "تيك توك",
  OTHER: "أخرى",
} as const;

export const SOURCE_LABEL: Record<string, string> = { WEBSITE: "الموقع", ...MANUAL_SOURCES };

export const MANUAL_SOURCES_EN: Record<keyof typeof MANUAL_SOURCES, string> = {
  WHATSAPP: "WhatsApp",
  PHONE: "Phone call",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  OTHER: "Other",
};

export const sourceLabel = (s: string, lang: "ar" | "en" = "ar") => (lang === "en" ? ({ WEBSITE: "Website", ...MANUAL_SOURCES_EN } as Record<string, string>) : SOURCE_LABEL)[s] ?? s;

const money = z.coerce.number().int().min(0).max(10_000_000);

const lines = z
  .array(z.object({ variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(100), unitPrice: z.number().int().min(0).max(10_000_000) }))
  .min(1, "items")
  .max(30, "items");

/** Where a typed-in order starts. DELIVERED: the customer came to the shop and left with it. */
export const START_AS = { NEW: "جديد", CONFIRMED: "مؤكَّد", DELIVERED: "تسلّم فالمحل" } as const;
export const START_AS_EN: Record<keyof typeof START_AS, string> = { NEW: "New", CONFIRMED: "Confirmed", DELIVERED: "Picked up in the shop" };
export const IN_SHOP_ADDRESS = "استلم من المحل";

export const manualOrderInput = z
  .object({
    items: z.string().transform((s, ctx) => {
      try {
        return lines.parse(JSON.parse(s));
      } catch {
        ctx.addIssue({ code: "custom", message: "items" });
        return z.NEVER;
      }
    }),
    name: z.string().trim().min(2, "name").max(80, "name"),
    phone: z.string().transform((s, ctx) => normalizeMoroccanPhone(s) ?? (ctx.addIssue({ code: "custom", message: "phone" }), z.NEVER)),
    cityId: z.string().min(1, "city").max(40, "city"),
    address: z.string().trim().max(300, "address").default(""),
    notes: z.string().trim().max(500, "notes").optional().transform((s) => s || null),
    source: z.enum(Object.keys(MANUAL_SOURCES) as [keyof typeof MANUAL_SOURCES, ...(keyof typeof MANUAL_SOURCES)[]]),
    shippingFee: money,
    discount: money,
    startAs: z.enum(["NEW", "CONFIRMED", "DELIVERED"]).default("CONFIRMED"),
  })
  // A sale at the shop needs no delivery address.
  .transform((o, ctx) => {
    if (o.address.length >= 3) return o;
    if (o.startAs === "DELIVERED") return { ...o, address: IN_SHOP_ADDRESS };
    ctx.addIssue({ code: "custom", message: "address", path: ["address"] });
    return z.NEVER;
  });

export type ManualOrderInput = z.infer<typeof manualOrderInput>;

/** Null total when the discount is bigger than what is being sold: the form refuses it. */
export function manualTotals(items: { unitPrice: number; qty: number }[], shippingFee: number, discount: number) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  return { subtotal, shippingFee, discount, total: discount > subtotal ? null : subtotal - discount + shippingFee };
}

/** The same delivery rule as the shop, as the starting value the owner can change. */
export const suggestedShipping = (subtotal: number, discount: number, cityFee: number, freeThreshold: number) => (subtotal - discount >= freeThreshold ? 0 : cityFee);

export const MANUAL_ERROR: Record<string, string> = {
  items: "زيد منتج واحد على الأقل.",
  name: "اكتب اسم الزبون.",
  phone: "رقم هاتف مغربي غير صالح.",
  city: "اختر المدينة.",
  address: "اكتب العنوان.",
  notes: "الملاحظة طويلة بزاف.",
};

const MANUAL_ERROR_EN: Record<string, string> = {
  items: "Add at least one product.",
  name: "Type the customer's name.",
  phone: "Not a valid Moroccan phone number.",
  city: "Pick the city.",
  address: "Type the address.",
  notes: "The note is too long.",
};

export const manualError = (key: string | undefined, lang: "ar" | "en" = "ar"): string | undefined =>
  key === undefined ? undefined : (lang === "en" ? MANUAL_ERROR_EN : MANUAL_ERROR)[key];
