import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LandingView } from "@/components/landing/LandingView";
import { redirect } from "@/i18n/navigation";
import { getLandingProduct, getPublishedLandingSlugs, publishedOf } from "@/lib/landing-data";
import { absoluteUrl } from "@/lib/seo";
import { getCheckoutConfig } from "@/lib/store-config";

export async function generateStaticParams() {
  const slugs = (await getPublishedLandingSlugs()).map((slug) => ({ slug }));
  // The build needs at least one page; with no page published yet this one is simply a 404.
  return slugs.length ? slugs : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/offers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getLandingProduct(slug);
  const page = p && publishedOf(p);
  if (!p || !page) return {};
  // An ad page repeats the product page: search engines are pointed at the product instead.
  return {
    title: page.content.headline || p.nameAr,
    description: page.content.subline || undefined,
    robots: { index: false, follow: true },
    alternates: { canonical: absoluteUrl("ar", `/products/${p.slug}`) },
  };
}

/** A product's published landing page (ads). Arabic only: /en/offers/... sends to the Arabic page. */
export default async function OfferPage({ params }: PageProps<"/[locale]/offers/[slug]">) {
  const { locale, slug } = await params;
  if (locale !== "ar") redirect({ href: `/offers/${slug}`, locale: "ar" });
  setRequestLocale("ar");
  const [p, config] = await Promise.all([getLandingProduct(slug), getCheckoutConfig()]);
  const page = p && publishedOf(p);
  if (!p || !page) notFound();
  return <LandingView product={p} page={page} config={config} />;
}
