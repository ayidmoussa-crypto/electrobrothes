import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { separatePrice, type BundleRule } from "./bundles";
import { db } from "./db";

// Packs for the storefront. Cached under "products" (stock and prices change there) and "bundles" (admin edits).

const bundleSelect = {
  id: true,
  slug: true,
  nameAr: true,
  nameEn: true,
  taglineAr: true,
  taglineEn: true,
  image: true,
  price: true,
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      quantity: true,
      product: {
        select: {
          id: true,
          slug: true,
          nameAr: true,
          nameEn: true,
          isActive: true,
          images: { select: { url: true, altAr: true, altEn: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          variants: {
            select: { id: true, colorAr: true, colorEn: true, colorHex: true, storage: true, price: true, compareAtPrice: true, stock: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  },
} satisfies Prisma.BundleSelect;

type BundleRow = Prisma.BundleGetPayload<{ select: typeof bundleSelect }>;

function toBundle(b: BundleRow) {
  const items = b.items.map((i) => {
    const inStock = i.product.variants.filter((v) => v.stock > 0);
    const minPrice = Math.min(...(inStock.length ? inStock : i.product.variants).map((v) => v.price));
    return {
      quantity: i.quantity,
      productId: i.product.id,
      slug: i.product.slug,
      nameAr: i.product.nameAr,
      nameEn: i.product.nameEn,
      image: i.product.images[0] ?? null,
      minPrice,
      variants: i.product.variants,
      // Enough of this product for one pack, in any colours.
      available: i.product.isActive && inStock.reduce((s, v) => s + v.stock, 0) >= i.quantity,
    };
  });
  const separate = separatePrice(items);
  return {
    id: b.id,
    slug: b.slug,
    nameAr: b.nameAr,
    nameEn: b.nameEn,
    taglineAr: b.taglineAr,
    taglineEn: b.taglineEn,
    image: b.image,
    price: b.price,
    separate,
    saving: Math.max(0, separate - b.price),
    available: items.length > 0 && items.every((i) => i.available),
    items,
  };
}

export type BundleData = ReturnType<typeof toBundle>;

/** Packs that can be ordered right now, for the home page and the packs page. */
export async function getBundles() {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", "bundles");
  const rows = await db.bundle.findMany({ where: { isActive: true }, select: bundleSelect, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return rows.map(toBundle).filter((b) => b.available && b.saving > 0);
}

/** One pack for its page; shown even when sold out, so a shared link does not break. */
export async function getBundle(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", "bundles", `bundle:${slug}`);
  const row = await db.bundle.findFirst({ where: { slug, isActive: true }, select: bundleSelect });
  return row ? toBundle(row) : null;
}

export async function getBundleSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("bundles");
  return db.bundle.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } });
}

/** Pricing rules of the active packs that touch these products. Not cached: the order action prices with it. */
export async function bundleRulesFor(productIds: string[]): Promise<BundleRule[]> {
  if (!productIds.length) return [];
  const rows = await db.bundle.findMany({
    where: { isActive: true, items: { some: { productId: { in: productIds } } } },
    select: { id: true, price: true, items: { select: { productId: true, quantity: true } } },
  });
  return rows;
}
