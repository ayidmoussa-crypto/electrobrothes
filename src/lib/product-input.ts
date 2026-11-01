import { z } from "zod";

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
          stock: z.coerce.number().int().min(0).max(100_000),
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
  });

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
    stock: number | string;
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
  specKey: "مفتاح المواصفة بحروف لاتينية صغيرة (مثال: ram)",
  spec: "قيمة المواصفة مطلوبة باللغتين",
};
