"use server";

import { z } from "zod";
import { db } from "@/lib/db";

const ids = z.array(z.string().min(1).max(40)).max(20);

export type CartLine = {
  variantId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  labelAr: string | null;
  labelEn: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  image: string | null;
};

export type Upsell = { variantId: string; slug: string; nameAr: string; nameEn: string; price: number; image: string | null };

/** Current price/stock/name for the variants in a browser cart, plus accessories to suggest. */
export async function getCartLines(variantIds: string[]): Promise<{ lines: CartLine[]; upsell: Upsell[] }> {
  const parsed = ids.safeParse(variantIds);
  if (!parsed.success) return { lines: [], upsell: [] };

  const variants = await db.variant.findMany({
    where: { id: { in: parsed.data }, product: { isActive: true } },
    include: {
      product: { select: { slug: true, nameAr: true, nameEn: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } } },
    },
  });
  const productSlugs = variants.map((v) => v.product.slug);

  const accessories = await db.product.findMany({
    where: { isActive: true, category: { slug: { in: ["chargers", "power-banks"] } }, slug: { notIn: productSlugs }, variants: { some: { stock: { gt: 0 } } } },
    select: {
      slug: true,
      nameAr: true,
      nameEn: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { where: { stock: { gt: 0 } }, select: { id: true, price: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { isBestSeller: "desc" },
    take: 4,
  });

  return {
    lines: variants.map((v) => ({
      variantId: v.id,
      slug: v.product.slug,
      nameAr: v.product.nameAr,
      nameEn: v.product.nameEn,
      labelAr: [v.colorAr, v.storage].filter(Boolean).join(" · ") || null,
      labelEn: [v.colorEn, v.storage].filter(Boolean).join(" · ") || null,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      stock: v.stock,
      image: v.product.images[0]?.url ?? null,
    })),
    upsell: accessories.map((p) => ({
      variantId: p.variants[0].id,
      slug: p.slug,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      price: p.variants[0].price,
      image: p.images[0]?.url ?? null,
    })),
  };
}
