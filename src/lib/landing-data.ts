import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import { cleanDraft, defaultLandingContent, isTemplate, landingDraftSchema, normalizeSections, readPublished, type PublishedLanding } from "./landing";

const productSelect = {
  id: true,
  slug: true,
  nameAr: true,
  nameEn: true,
  descriptionAr: true,
  highlightsAr: true,
  warrantyMonths: true,
  dealEndsAt: true,
  isActive: true,
  category: { select: { nameAr: true } },
  images: { select: { url: true, altAr: true }, orderBy: { sortOrder: "asc" as const }, take: 6 },
  variants: {
    select: { id: true, colorAr: true, colorHex: true, storage: true, price: true, compareAtPrice: true, stock: true, isDefault: true },
    orderBy: { sortOrder: "asc" as const },
  },
  specs: { select: { key: true, valueAr: true }, orderBy: { sortOrder: "asc" as const } },
  faqs: { select: { questionAr: true, answerAr: true }, orderBy: { sortOrder: "asc" as const } },
  // Only reviews from delivered orders, as everywhere else in the shop. None: the section hides.
  reviews: {
    select: { id: true, authorName: true, city: true, rating: true, comment: true },
    where: { isApproved: true, verified: true },
    orderBy: { createdAt: "desc" as const },
    take: 6,
  },
  landingPage: { select: { template: true, sections: true, content: true, published: true, publishedAt: true, updatedAt: true, model: true } },
};

/** Everything a landing page shows about one product, straight from the catalog. Cached with the catalog. */
export async function getLandingProduct(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", "landing", `product:${slug}`);
  const p = await db.product.findUnique({ where: { slug }, select: productSelect });
  if (!p || !p.isActive || !p.variants.length || !p.images.length) return null;
  const now = Date.now();
  return { ...p, dealEndsAt: p.dealEndsAt && p.dealEndsAt.getTime() > now ? p.dealEndsAt : null };
}

export type LandingProduct = NonNullable<Awaited<ReturnType<typeof getLandingProduct>>>;

/** What shoppers see: the published version only. */
export const publishedOf = (p: LandingProduct): PublishedLanding | null => readPublished(p.landingPage?.published);

/** What the owner is working on: the saved draft, or a first draft from the product's own data. */
export function draftOf(p: Pick<LandingProduct, "landingPage" | "nameAr" | "descriptionAr" | "highlightsAr" | "specs" | "faqs">): PublishedLanding {
  const lp = p.landingPage;
  const saved = lp ? landingDraftSchema.safeParse(lp.content) : null;
  return {
    template: lp && isTemplate(lp.template) ? lp.template : "dark_premium",
    sections: normalizeSections(lp?.sections),
    content: saved?.success ? saved.data : defaultLandingContent(p),
  };
}

/** Same draft with empty rows dropped, as the page renders it. */
export const draftForView = (p: LandingProduct): PublishedLanding => {
  const d = draftOf(p);
  return { ...d, content: cleanDraft(d.content) };
};

/** Products whose page is live, for the build's list of pages. */
export async function getPublishedLandingSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("products", "landing");
  const rows = await db.landingPage.findMany({ where: { publishedAt: { not: null }, product: { isActive: true } }, select: { product: { select: { slug: true } } } });
  return rows.map((r) => r.product.slug);
}
