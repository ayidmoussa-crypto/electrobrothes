import { Banknote, BadgeCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { BundleVisual } from "@/components/store/BundleCard";
import { BundlePurchase } from "@/components/store/BundlePurchase";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getBundle, getBundleSlugs } from "@/lib/bundles-data";
import { formatMAD } from "@/lib/money";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { shareImageUrl } from "@/lib/seo-content/rules";
import { getCheckoutConfig } from "@/lib/store-config";

export async function generateStaticParams() {
  const slugs = (await getBundleSlugs()).map((b) => ({ slug: b.slug }));
  // The build needs at least one page; with no packs yet this one is simply a 404.
  return slugs.length ? slugs : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/bundles/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const b = await getBundle(slug);
  if (!b) return {};
  const ar = locale === "ar";
  const t = await getTranslations({ locale, namespace: "bundles" });
  const names = b.items.map((i) => (ar ? i.nameAr : i.nameEn)).join(" + ");
  return pageMetadata({
    locale: locale as Locale,
    path: `/bundles/${slug}`,
    title: ar ? b.nameAr : b.nameEn,
    description: `${(ar ? b.taglineAr : b.taglineEn) || names}. ${t("packPrice")}: ${formatMAD(b.price, locale as Locale)}`,
    image: shareImageUrl(b.image ?? b.items.find((i) => i.image)?.image?.url),
  });
}

export default async function BundlePage({ params }: PageProps<"/[locale]/bundles/[slug]">) {
  const { locale: l, slug } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const bundle = await getBundle(slug);
  if (!bundle) notFound();

  const [t, tp, config] = await Promise.all([getTranslations("bundles"), getTranslations("pdp"), getCheckoutConfig()]);
  const ar = locale === "ar";
  const name = ar ? bundle.nameAr : bundle.nameEn;
  const tagline = ar ? bundle.taglineAr : bundle.taglineEn;

  return (
    // Bottom padding leaves room for the sticky phone order bar.
    <div className="mx-auto max-w-7xl px-4 pb-28 lg:pb-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          description: tagline || bundle.items.map((i) => (ar ? i.nameAr : i.nameEn)).join(" + "),
          image: bundle.image ?? bundle.items.find((i) => i.image)?.image?.url,
          url: absoluteUrl(locale, `/bundles/${bundle.slug}`),
          offers: {
            "@type": "Offer",
            price: bundle.price,
            priceCurrency: "MAD",
            availability: bundle.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }}
      />
      <Breadcrumbs locale={locale} items={[{ label: t("title"), href: "/bundles" }, { label: name }]} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="relative aspect-[4/3] overflow-hidden lg:aspect-square rounded-2xl border border-warm-200 bg-warm-50 lg:sticky lg:top-40 lg:self-start">
          <BundleVisual bundle={bundle} locale={locale} sizes="(min-width: 1024px) 50vw, 100vw" priority />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <span className="text-sm font-semibold text-warm-600">{t("pieces", { count: bundle.items.reduce((s, i) => s + i.quantity, 0) })}</span>
            <h1 className="mt-1 text-3xl md:text-4xl">{name}</h1>
            {tagline ? <p className="mt-2 text-lg text-warm-600">{tagline}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-3xl font-extrabold text-ink">{formatMAD(bundle.price, locale)}</span>
            {bundle.saving > 0 ? (
              <>
                <s className="text-lg text-warm-500">{formatMAD(bundle.separate, locale)}</s>
                <span className="rounded-md bg-success-soft px-2 py-1 text-sm font-bold text-success">{t("save", { amount: formatMAD(bundle.saving, locale) })}</span>
              </>
            ) : null}
          </div>

          <section aria-labelledby="in-pack">
            <h2 id="in-pack" className="mb-3 text-lg">
              {t("inPack")}
            </h2>
            <ul className="flex flex-col divide-y divide-warm-200 rounded-xl border border-warm-200">
              {bundle.items.map((i) => (
                <li key={i.productId} className="flex items-center gap-3 p-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-warm-50">
                    {i.image ? <Image src={i.image.url} alt="" fill sizes="64px" unoptimized={i.image.url.endsWith(".svg")} className="object-contain p-1.5" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${i.slug}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                      {ar ? i.nameAr : i.nameEn}
                    </Link>
                    <p className="text-sm text-warm-600">{formatMAD(i.minPrice, locale)}</p>
                  </div>
                  {i.quantity > 1 ? <span className="shrink-0 rounded-full bg-warm-100 px-2.5 py-1 text-sm font-bold text-ink">×{i.quantity}</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <BundlePurchase
            name={name}
            price={bundle.price}
            available={bundle.available}
            locale={locale}
            items={bundle.items.map((i) => ({ productId: i.productId, name: ar ? i.nameAr : i.nameEn, quantity: i.quantity, variants: i.variants }))}
          />

          <ul className="flex flex-col gap-2 border-t border-warm-200 pt-4 text-sm text-warm-800">
            <li className="flex items-center gap-2">
              <Banknote className="size-5 shrink-0 text-ink" aria-hidden="true" />
              {tp("codNote")}
            </li>
            <li className="flex items-center gap-2">
              <Truck className="size-5 shrink-0 text-ink" aria-hidden="true" />
              {tp("deliveryNote", { time: ar ? config.deliveryTime.ar : config.deliveryTime.en })}
            </li>
            <li className="flex items-center gap-2">
              <BadgeCheck className="size-5 shrink-0 text-ink" aria-hidden="true" />
              {tp("genuine")}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
