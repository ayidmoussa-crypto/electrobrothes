import type { Prisma } from "@/generated/prisma/client";

/** What SEO generation and scoring read about a product. */
export const contentSelect = {
  id: true,
  slug: true,
  nameAr: true,
  nameEn: true,
  warrantyMonths: true,
  metaTitleAr: true,
  metaTitleEn: true,
  metaDescriptionAr: true,
  metaDescriptionEn: true,
  focusKeywordAr: true,
  focusKeywordEn: true,
  descriptionAr: true,
  descriptionEn: true,
  highlightsAr: true,
  highlightsEn: true,
  categoryId: true,
  brandId: true,
  brand: { select: { name: true } },
  category: { select: { nameEn: true } },
  images: { orderBy: { sortOrder: "asc" }, select: { url: true, altAr: true, altEn: true } },
  specs: { orderBy: { sortOrder: "asc" }, select: { key: true, valueAr: true, valueEn: true, numericValue: true } },
  faqs: { orderBy: { sortOrder: "asc" }, select: { questionAr: true, answerAr: true, questionEn: true, answerEn: true } },
} satisfies Prisma.ProductSelect;
