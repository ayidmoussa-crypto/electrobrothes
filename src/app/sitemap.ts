import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getBundleSlugs } from "@/lib/bundles-data";
import { getCategories, getProductSlugs } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";
import { STATIC_SLUGS } from "@/lib/static-pages";

// Every indexable page in both languages, each entry listing its hreflang alternates.
// Cart, checkout, search, compare, order and admin pages are noindex and left out on purpose.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, bundles] = await Promise.all([getCategories(), getProductSlugs(), getBundleSlugs()]);

  const entry = (path: string, priority: number, lastModified?: Date) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(locale, path),
      lastModified,
      priority,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, absoluteUrl(l, path)])) },
    }));

  return [
    ...entry("/", 1),
    ...entry("/promotions", 0.8),
    ...categories.flatMap((c) => entry(`/category/${c.slug}`, 0.8)),
    ...products.flatMap((p) => entry(`/products/${p.slug}`, 0.7, p.updatedAt)),
    ...(bundles.length ? entry("/bundles", 0.7) : []),
    ...bundles.flatMap((b) => entry(`/bundles/${b.slug}`, 0.7, b.updatedAt)),
    ...STATIC_SLUGS.flatMap((s) => entry(`/${s}`, 0.3)),
    ...entry("/track", 0.3),
  ];
}
