import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

// Reads are cached and tagged; admin writes call revalidateTag("products" | "categories").

const cardSelect = {
  slug: true,
  nameAr: true,
  nameEn: true,
  isBestSeller: true,
  isFeatured: true,
  dealEndsAt: true,
  createdAt: true,
  brand: { select: { name: true, slug: true } },
  images: { select: { url: true, altAr: true, altEn: true }, orderBy: { sortOrder: "asc" }, take: 1 },
  variants: { select: { price: true, compareAtPrice: true, stock: true, storage: true }, orderBy: { sortOrder: "asc" } },
  reviews: { select: { rating: true }, where: { isApproved: true, verified: true } },
  specs: { select: { key: true, valueEn: true, numericValue: true }, where: { key: { in: ["ram", "storage", "screen", "cpu"] } } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/** "128GB" → 128, "1TB" → 1024. */
const storageGb = (s: string | null) => {
  const m = s?.match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
  return m ? Number(m[1]) * (m[2].toUpperCase() === "TB" ? 1024 : 1) : null;
};

function toCard(p: CardRow) {
  const prices = p.variants.map((v) => v.price);
  const cheapest = p.variants.reduce((a, b) => (b.price < a.price ? b : a), p.variants[0]);
  const ratings = p.reviews.map((r) => r.rating);
  const spec = (key: string) => p.specs.find((s) => s.key === key);
  const storage = new Set<number>();
  for (const v of p.variants) {
    const gb = storageGb(v.storage);
    if (gb) storage.add(gb);
  }
  const specStorage = spec("storage")?.numericValue;
  if (specStorage) storage.add(specStorage);

  return {
    slug: p.slug,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    brand: p.brand.name,
    brandSlug: p.brand.slug,
    image: p.images[0] ?? null,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    compareAtPrice: cheapest?.compareAtPrice ?? null,
    stock: p.variants.reduce((sum, v) => sum + v.stock, 0),
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    reviewCount: ratings.length,
    isBestSeller: p.isBestSeller,
    isFeatured: p.isFeatured,
    dealEndsAt: p.dealEndsAt,
    createdAt: p.createdAt.getTime(),
    facets: {
      ram: spec("ram")?.numericValue ?? null,
      screen: spec("screen")?.numericValue ?? null,
      cpu: spec("cpu")?.valueEn ?? null,
      storage: [...storage],
    },
  };
}

export type ProductCardData = ReturnType<typeof toCard>;

const visible = (where: Prisma.ProductWhereInput = {}): Prisma.ProductWhereInput => ({
  isActive: true,
  variants: { some: {} },
  ...where,
});

export async function getCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");
  return db.category.findMany({
    select: { slug: true, nameAr: true, nameEn: true, image: true, descriptionAr: true, descriptionEn: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getCategory(slug: string) {
  const all = await getCategories();
  return all.find((c) => c.slug === slug) ?? null;
}

export async function getBrands() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return db.brand.findMany({
    where: { products: { some: { isActive: true } } },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getProductCards(filter: { categorySlug?: string; bestSellers?: boolean; deals?: boolean; take?: number } = {}) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const rows = await db.product.findMany({
    where: visible({
      ...(filter.categorySlug ? { category: { slug: filter.categorySlug } } : {}),
      ...(filter.bestSellers ? { isBestSeller: true } : {}),
      // Deals are filtered on expiry by the caller: comparing to "now" here would freeze the cache.
      ...(filter.deals ? { dealEndsAt: { not: null } } : {}),
    }),
    select: cardSelect,
    orderBy: { createdAt: "desc" },
    take: filter.take,
  });
  return rows.map(toCard);
}

/** Deals still running right now, soonest-ending first. Request-time: callers must sit in <Suspense>. */
export async function getActiveDeals(take = 4) {
  await connection();
  const now = Date.now();
  return (await getProductCards({ deals: true }))
    .filter((p) => p.dealEndsAt && p.dealEndsAt.getTime() > now && p.stock > 0)
    .sort((a, b) => a.dealEndsAt!.getTime() - b.dealEndsAt!.getTime())
    .slice(0, take);
}

/** Free-text search over product, brand and category names in both languages. */
export async function searchProducts(q: string, take?: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!terms.length) return [];
  const rows = await db.product.findMany({
    where: visible({
      AND: terms.map((term) => ({
        OR: [
          { nameAr: { contains: term, mode: "insensitive" } },
          { nameEn: { contains: term, mode: "insensitive" } },
          { brand: { name: { contains: term, mode: "insensitive" } } },
          { category: { nameAr: { contains: term, mode: "insensitive" } } },
          { category: { nameEn: { contains: term, mode: "insensitive" } } },
        ],
      })),
    }),
    select: cardSelect,
    orderBy: [{ isBestSeller: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(toCard);
}

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", `product:${slug}`);
  const p = await db.product.findFirst({
    where: visible({ slug }),
    // Purchase prices and stock-alert settings are admin-only: never loaded for the storefront.
    omit: { costPrice: true },
    include: {
      brand: { select: { name: true, slug: true } },
      category: { select: { slug: true, nameAr: true, nameEn: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: { omit: { costPrice: true, lowStockAt: true }, orderBy: { sortOrder: "asc" } },
      specs: { orderBy: { sortOrder: "asc" } },
      faqs: { orderBy: { sortOrder: "asc" } },
      reviews: { where: { isApproved: true, verified: true }, orderBy: { createdAt: "desc" } },
      externalRatings: { where: { status: "APPROVED" }, orderBy: { source: "asc" }, select: { id: true, source: true, url: true, rating: true, ratingMax: true, ratingCount: true, summaryAr: true, summaryEn: true } },
    },
  });
  if (!p) return null;
  const ratings = p.reviews.map((r) => r.rating);
  return {
    ...p,
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

/** The product's current address when this slug is an old one; null otherwise. */
export async function getSlugRedirect(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", `product:${slug}`);
  const row = await db.slugRedirect.findUnique({ where: { slug }, select: { product: { select: { slug: true, isActive: true } } } });
  return row?.product.isActive ? row.product.slug : null;
}

export async function getProductSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return db.product.findMany({ where: visible(), select: { slug: true, updatedAt: true } });
}

export async function getTestimonials(take = 3) {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return db.review.findMany({
    where: { isApproved: true, verified: true, rating: 5 },
    select: { id: true, authorName: true, city: true, rating: true, comment: true, product: { select: { nameAr: true, nameEn: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}
