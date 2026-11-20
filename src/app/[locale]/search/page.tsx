import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { Listing } from "@/components/store/Listing";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import { StatePanel } from "@/components/ui/States";
import type { Locale } from "@/i18n/routing";
import { getProductCards, searchProducts } from "@/lib/catalog";
import { VisitEvent } from "@/components/analytics/VisitTracker";

// Result pages are useful for shoppers, not as search-engine landing pages.
export const metadata: Metadata = { robots: { index: false, follow: true } };

type Raw = Record<string, string | string[] | undefined>;

async function Results({ locale, searchParams }: { locale: Locale; searchParams: Promise<Raw> }) {
  const raw = await searchParams;
  const q = (Array.isArray(raw.q) ? raw.q[0] : raw.q)?.trim().slice(0, 80) ?? "";
  const t = await getTranslations({ locale, namespace: "search" });
  // No query (e.g. "best sellers → view all"): browse the whole catalog with the same filters.
  const items = q ? await searchProducts(q) : await getProductCards();

  return (
    <>
      <h1 className="mb-6 text-3xl md:text-4xl">{q ? t("resultsFor", { q }) : t("title")}</h1>
      {/* What shoppers look for, and what they do not find: stock ideas for the owner (visitors page). */}
      {q ? <VisitEvent event={{ type: "search", query: q, results: Math.min(items.length, 1000) }} /> : null}
      <Listing
        locale={locale}
        basePath="/search"
        items={items}
        searchParams={raw}
        q={q || undefined}
        empty={q && !items.length ? <StatePanel icon={SearchX} title={t("noResults", { q })} description={t("noResultsText")} /> : undefined}
      />
    </>
  );
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tp] = await Promise.all([getTranslations("search"), getTranslations("product")]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ label: t("title") }]} />
      <Suspense fallback={<ProductGridSkeleton label={tp("loading")} />}>
        <Results locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
