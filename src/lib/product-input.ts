import { z } from "zod";
import { nameColors } from "./color-names";

// Admin product editor payload. Shared by the client editor (types) and the server action (validation).

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

const text = (max: number) => z.string().trim().max(max);
const money = z.coerce.number().int().min(0).max(1_000_000);
const optionalMoney = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), money.nullable());
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), text(max).nullable());

export const productInput = z
  .object({
    id: z.string().max(40).optional(),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug").max(80),
    nameAr: text(160).min(2, "nameAr"),
    nameEn: text(160).min(2, "nameEn"),
    descriptionAr: text(5000).min(10, "descriptionAr"),
    descriptionEn: text(5000).min(10, "descriptionEn"),
    categoryId: z.string().min(1, "category").max(40),
    brandId: z.string().min(1, "brand").max(40),
    warrantyMonths: z.coerce.number().int().min(0).max(120),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    isBestSeller: z.boolean(),
    // "YYYY-MM-DDTHH:mm" from <input type="datetime-local">, interpreted as Moroccan time.
    dealEndsAt: z.preprocess(
      (v) => (v ? v : null),
      z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "dealEndsAt").nullable(),
    ),
    // Purchase price per unit (admin only); a colour may override it.
    costPrice: optionalMoney,
    images: z
      .array(z.object({ url: z.string().trim().max(500).refine((u) => u.startsWith("/") || u.startsWith("https://"), "image"), altAr: text(200), altEn: text(200) }))
      .min(1, "images")
      .max(12),
    variants: z
      .array(
        z.object({
          id: z.string().max(40).optional(),
          sku: z.string().trim().min(2, "sku").max(60).transform((s) => s.toUpperCase()),
          colorAr: optionalText(40),
          colorEn: optionalText(40),
          colorHex: z.preprocess((v) => (v ? v : null), z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable()),
          storage: optionalText(20),
          price: money.refine((n) => n > 0, "price"),
          compareAtPrice: optionalMoney,
          costPrice: optionalMoney,
          stock: z.coerce.number().int().min(0).max(100_000),
          // Stock when the editor was opened: the server applies (stock − stockBase) as a move, so an
          // order confirmed meanwhile is not overwritten.
          stockBase: z.coerce.number().int().min(0).max(100_000),
          // A lower quantity that only cancels units entered by mistake: never counted as a loss.
          stockMistake: z.boolean().optional().default(false),
          lowStockAt: z.coerce.number().int().min(0).max(1_000),
        }),
      )
      .min(1, "variants")
      .max(30),
    specs: z
      .array(
        z.object({
          key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/, "specKey").max(30),
          valueAr: text(120).min(1, "spec"),
          valueEn: text(120).min(1, "spec"),
          numericValue: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().finite().nullable()),
        }),
      )
      .max(30),
  })
  .superRefine((p, ctx) => {
    const skus = p.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) ctx.addIssue({ code: "custom", message: "duplicateSku", path: ["variants"] });
    for (const [i, v] of p.variants.entries()) {
      if (v.compareAtPrice !== null && v.compareAtPrice <= v.price) {
        ctx.addIssue({ code: "custom", message: "compareAt", path: ["variants", i, "compareAtPrice"] });
      }
    }
    // Several options must be told apart by the customer: each needs a colour (or a capacity), all different.
    if (p.variants.length > 1) {
      const names = p.variants.map((v) => [v.colorHex?.toLowerCase() ?? v.colorAr, v.storage].filter(Boolean).join("|"));
      if (names.some((n) => !n)) ctx.addIssue({ code: "custom", message: "colorRequired", path: ["variants"] });
      else if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "duplicateColor", path: ["variants"] });
    }
  })
  // The owner only picks a swatch: its name is given here (lib/color-names.ts). The storefront picker keys colours on
  // the English name, so a colour without a swatch falls back to its Arabic one.
  .transform((p) => ({ ...p, variants: nameColors(p.variants).map((v) => ({ ...v, colorEn: v.colorEn ?? v.colorAr })) }));

/** What the editor holds: form strings, parsed and normalised by `productInput` on the server. */
export type ProductInput = {
  id?: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  categoryId: string;
  brandId: string;
  warrantyMonths: number | string;
  isActive: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  dealEndsAt: string | null;
  costPrice: number | string;
  images: { url: string; altAr: string; altEn: string }[];
  variants: {
    id?: string;
    sku: string;
    colorAr: string;
    colorEn: string;
    colorHex: string;
    storage: string;
    price: number | string;
    compareAtPrice: number | string;
    costPrice: number | string;
    stock: number | string;
    stockBase: number;
    /** Lowering the stock: units entered by mistake (CORRECTION), not a loss. */
    stockMistake?: boolean;
    lowStockAt: number | string;
  }[];
  specs: { key: string; valueAr: string; valueEn: string; numericValue: number | string }[];
};

export const PRODUCT_ERRORS: Record<string, string> = {
  slug: "الرابط (slug) يجب أن يكون بحروف لاتينية صغيرة وأرقام وشرطات فقط",
  nameAr: "الاسم بالعربية مطلوب",
  nameEn: "الاسم بالإنجليزية مطلوب",
  descriptionAr: "الوصف بالعربية قصير جداً (10 أحرف على الأقل)",
  descriptionEn: "الوصف بالإنجليزية قصير جداً (10 أحرف على الأقل)",
  category: "اختر القسم",
  brand: "اختر الماركة",
  dealEndsAt: "تاريخ نهاية العرض غير صالح",
  image: "رابط الصورة يجب أن يبدأ بـ https:// أو /",
  images: "أضف صورة واحدة على الأقل",
  sku: "رمز SKU مطلوب لكل خيار",
  price: "السعر يجب أن يكون أكبر من 0",
  variants: "أضف خياراً واحداً على الأقل",
  duplicateSku: "رموز SKU يجب أن تكون مختلفة",
  compareAt: "السعر قبل التخفيض يجب أن يكون أكبر من السعر الحالي",
  colorRequired: "عند وجود أكثر من لون، اكتب اسم كل لون",
  duplicateColor: "أسماء الألوان يجب أن تكون مختلفة",
  specKey: "مفتاح المواصفة بحروف لاتينية صغيرة (مثال: ram)",
  spec: "قيمة المواصفة مطلوبة باللغتين",
};

export const PRODUCT_ERRORS_EN: Record<keyof typeof PRODUCT_ERRORS, string> = {
  slug: "The link (slug) may only hold lower-case Latin letters, digits and dashes",
  nameAr: "The Arabic name is required",
  nameEn: "The English name is required",
  descriptionAr: "The Arabic description is too short (10 characters at least)",
  descriptionEn: "The English description is too short (10 characters at least)",
  category: "Pick the category",
  brand: "Pick the brand",
  dealEndsAt: "The deal end date is not valid",
  image: "An image link must start with https:// or /",
  images: "Add at least one image",
  sku: "Every option needs a SKU",
  price: "The price must be above 0",
  variants: "Add at least one option",
  duplicateSku: "SKUs must be different",
  compareAt: "The price before discount must be above the current price",
  colorRequired: "With more than one colour, name each colour",
  duplicateColor: "Colour names must be different",
  specKey: "A spec key uses lower-case Latin letters (e.g. ram)",
  spec: "A spec value is required in both languages",
};
