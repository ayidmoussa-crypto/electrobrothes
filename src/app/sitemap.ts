import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getCategories, getProductSlugs } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";
import { STATIC_SLUGS } from "@/lib/static-pages";

// Every indexable page in both languages, each entry listing its hreflang alternates.
// Cart, checkout, search, compare, order and admin pages are noindex and left out on purpose.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProductSlugs()]);

  const entry = (path: string, priority: number, lastModified?: Date) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(locale, path),
      lastModified,
      priority,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, absoluteUrl(l, path)])) },
    }));

  return [
    ...entry("/", 1),
    ...categories.flatMap((c) => entry(`/category/${c.slug}`, 0.8)),
    ...products.flatMap((p) => entry(`/products/${p.slug}`, 0.7, p.updatedAt)),
    ...STATIC_SLUGS.flatMap((s) => entry(`/${s}`, 0.3)),
    ...entry("/track", 0.3),
  ];
}
