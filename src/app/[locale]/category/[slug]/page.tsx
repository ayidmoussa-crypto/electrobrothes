import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CategoryHero } from "@/components/store/CategoryHero";
import { Listing } from "@/components/store/Listing";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import type { Locale } from "@/i18n/routing";
import { getCategories, getCategory, getProductCards } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

/** The category's own description, or a sentence built from its name. Shown on the page and given to search engines. */
function blurb(category: { nameAr: string; nameEn: string; descriptionAr: string | null; descriptionEn: string | null }, ar: boolean) {
  const name = ar ? category.nameAr : category.nameEn;
  return (
    (ar ? category.descriptionAr : category.descriptionEn) ??
    (ar
      ? `تسوّق ${name} الأصلية في المغرب بأفضل الأسعار: ضمان رسمي، توصيل سريع والدفع نقداً عند الاستلام.`
      : `Shop genuine ${name.toLowerCase()} in Morocco at the best prices: official warranty, fast delivery and cash on delivery.`)
  );
}

export async function generateMetadata({ params }: PageProps<"/[locale]/category/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  const ar = locale === "ar";
  return pageMetadata({ locale: locale as Locale, path: `/category/${slug}`, title: ar ? category.nameAr : category.nameEn, description: blurb(category, ar) });
}

async function CategoryListing({
  locale,
  slug,
  searchParams,
}: {
  locale: Locale;
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [items, raw] = await Promise.all([getProductCards({ categorySlug: slug }), searchParams]);
  return <Listing locale={locale} basePath={`/category/${slug}`} items={items} searchParams={raw} />;
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[locale]/category/[slug]">) {
  const { locale: l, slug } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [category, t, tp, th, cards] = await Promise.all([getCategory(slug), getTranslations("product"), getTranslations("pdp"), getTranslations("header"), getProductCards({ categorySlug: slug })]);
  if (!category) notFound();
  const name = locale === "ar" ? category.nameAr : category.nameEn;
  // The banner's pictures: the ones chosen in the admin, else three of its products (best sellers first, in stock).
  const images = category.bannerImages.length
    ? category.bannerImages
    : [...cards]
        .filter((c) => c.image && c.stock > 0)
        .sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller))
        .slice(0, 3)
        .map((c) => c.image!.url);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <JsonLd
        data={breadcrumbLd(locale, [
          { name: tp("home"), path: "/" },
          { name, path: `/category/${slug}` },
        ])}
      />
      <Breadcrumbs locale={locale} items={[{ label: name }]} />
      <CategoryHero name={name} description={blurb(category, locale === "ar")} count={th("productCount", { count: category._count.products })} images={images} />
      {/* searchParams are request-time: only this part streams, the shell above is static. */}
      <Suspense fallback={<ProductGridSkeleton label={t("loading")} />}>
        <CategoryListing locale={locale} slug={slug} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
