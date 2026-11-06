import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { Listing } from "@/components/store/Listing";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import type { Locale } from "@/i18n/routing";
import { getPromoProducts } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";

type Raw = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: PageProps<"/[locale]/promotions">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "promotions" });
  return pageMetadata({ locale, path: "/promotions", title: t("title"), description: t("subtitle") });
}

async function Results({ locale, searchParams }: { locale: Locale; searchParams: Promise<Raw> }) {
  const [raw, items] = await Promise.all([searchParams, getPromoProducts()]);
  return <Listing locale={locale} basePath="/promotions" items={items} searchParams={raw} />;
}

export default async function PromotionsPage({ params, searchParams }: PageProps<"/[locale]/promotions">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tp] = await Promise.all([getTranslations("promotions"), getTranslations("product")]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ label: t("title") }]} />
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="mt-2 mb-6 text-warm-600">{t("subtitle")}</p>
      <Suspense fallback={<ProductGridSkeleton label={tp("loading")} />}>
        <Results locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
