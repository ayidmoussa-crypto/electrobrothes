import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import { isLive, isOfferStyle, offerHref, type OfferStyle } from "./offers";

const SPEC_KEYS_FOR_CARD = ["battery", "anc", "connectivity", "power", "capacity", "water", "port", "screen", "camera", "length"];

/**
 * The offers shown at the top of the home page right now: published, between their dates, product on sale with a
 * photo and stock. Price and old price come from the product (default colour, else the cheapest in stock). The
 * "features" style takes up to 4 of the product's own specs. Cached with the catalog; dates are checked here.
 */
export async function getHomeOffers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("offers", "products", "landing");
  const now = Date.now();
  const rows = await db.offer.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      style: true,
      titleAr: true,
      titleEn: true,
      sublineAr: true,
      sublineEn: true,
      image: true,
      link: true,
      isPublished: true,
      startsAt: true,
      endsAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          nameAr: true,
          nameEn: true,
          isActive: true,
          images: { select: { url: true, altAr: true, altEn: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          variants: { select: { price: true, compareAtPrice: true, stock: true, isDefault: true }, orderBy: { sortOrder: "asc" } },
          specs: { select: { key: true, valueAr: true, valueEn: true }, where: { key: { in: SPEC_KEYS_FOR_CARD } }, orderBy: { sortOrder: "asc" } },
          landingPage: { select: { publishedAt: true } },
        },
      },
    },
  });

  return rows
    .filter((o) => isLive(o, now) && o.product.isActive && o.product.images.length && o.product.variants.some((v) => v.stock > 0))
    .map((o) => {
      const p = o.product;
      const inStock = p.variants.filter((v) => v.stock > 0);
      const shown = inStock.find((v) => v.isDefault) ?? [...inStock].sort((a, b) => a.price - b.price)[0];
      return {
        id: o.id,
        style: (isOfferStyle(o.style) ? o.style : "dark") as OfferStyle,
        title: { ar: o.titleAr, en: o.titleEn || o.titleAr },
        subline: { ar: o.sublineAr, en: o.sublineEn || o.sublineAr },
        productId: p.id,
        name: { ar: p.nameAr, en: p.nameEn },
        image: { url: o.image ?? p.images[0].url, altAr: p.images[0].altAr || p.nameAr, altEn: p.images[0].altEn || p.nameEn },
        price: shown.price,
        compareAtPrice: shown.compareAtPrice && shown.compareAtPrice > shown.price ? shown.compareAtPrice : null,
        endsAt: o.endsAt,
        href: offerHref(o, p.slug, !!p.landingPage?.publishedAt),
        features: p.specs.slice(0, 4).map((s) => ({ key: s.key, valueAr: s.valueAr, valueEn: s.valueEn })),
      };
    });
}

export type HomeOffer = Awaited<ReturnType<typeof getHomeOffers>>[number];
