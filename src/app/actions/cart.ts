"use server";

import { z } from "zod";
import type { BundleRule } from "@/lib/bundles";
import { db } from "@/lib/db";

const ids = z.array(z.string().min(1).max(40)).max(20);

export type CartLine = {
  variantId: string;
  productId: string;
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

export type TopUpProduct = {
  variantId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  price: number;
  image: string | null;
  /** More than one colour or capacity in stock: the shopper has to choose on the product page. */
  hasOptions: boolean;
};

/** In-stock products a shopper can add to reach free delivery. Priced at the cheapest variant in stock. */
export async function getTopUpProducts(): Promise<TopUpProduct[]> {
  const products = await db.product.findMany({
    where: { isActive: true, variants: { some: { stock: { gt: 0 } } } },
    select: {
      slug: true,
      nameAr: true,
      nameEn: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { where: { stock: { gt: 0 } }, select: { id: true, price: true }, orderBy: { price: "asc" } },
    },
    take: 100,
  });
  return products.map((p) => ({
    variantId: p.variants[0].id,
    slug: p.slug,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    price: p.variants[0].price,
    image: p.images[0]?.url ?? null,
    hasOptions: p.variants.length > 1,
  }));
}

/** A pack the cart could complete, with its name for the summary line. */
export type CartBundle = BundleRule & { nameAr: string; nameEn: string };

/** Current price/stock/name for the variants in a browser cart, plus accessories to suggest. */
export async function getCartLines(variantIds: string[]): Promise<{ lines: CartLine[]; upsell: Upsell[]; bundles: CartBundle[] }> {
  const parsed = ids.safeParse(variantIds);
  if (!parsed.success) return { lines: [], upsell: [], bundles: [] };

  const variants = await db.variant.findMany({
    where: { id: { in: parsed.data }, product: { isActive: true } },
    include: {
      product: { select: { slug: true, nameAr: true, nameEn: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } } },
    },
  });
  const productSlugs = variants.map((v) => v.product.slug);
  const productIds = [...new Set(variants.map((v) => v.productId))];

  const bundles = productIds.length
    ? await db.bundle.findMany({
        where: { isActive: true, items: { some: { productId: { in: productIds } } } },
        select: { id: true, price: true, nameAr: true, nameEn: true, items: { select: { productId: true, quantity: true } } },
      })
    : [];

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
    bundles,
    lines: variants.map((v) => ({
      variantId: v.id,
      productId: v.productId,
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
