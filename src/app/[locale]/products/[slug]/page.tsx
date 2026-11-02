import { Banknote, BadgeCheck, Check, ChevronDown, ExternalLink, GitCompareArrows, ShieldCheck, Star, Truck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductGrid, SectionHeader } from "@/components/store/ProductGrid";
import { Rating } from "@/components/store/Rating";
import { ProductPurchase } from "@/components/store/ProductPurchase";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProduct, getProductCards, getProductSlugs, getSlugRedirect } from "@/lib/catalog";
import { formatCount, formatRating } from "@/lib/reviews/rules";
import { localizedPath, pageMetadata } from "@/lib/seo";
import { shareImageUrl } from "@/lib/seo-content/rules";
import { getCheckoutConfig } from "@/lib/store-config";
import { breadcrumbLd, faqLd, productLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateStaticParams() {
  return (await getProductSlugs()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  const ar = locale === "ar";
  const metaTitle = ar ? p.metaTitleAr : p.metaTitleEn;
  return pageMetadata({
    locale: locale as Locale,
    path: `/products/${slug}`,
    title: metaTitle || (ar ? p.nameAr : p.nameEn),
    fullTitle: !!metaTitle,
    description: (ar ? p.metaDescriptionAr : p.metaDescriptionEn) || (ar ? p.descriptionAr : p.descriptionEn),
    // Social networks cannot render SVG previews; the default brand image is used for those.
    image: shareImageUrl(p.images[0]?.url),
  });
}

const dateFormat = { ar: new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }), en: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }) };

export default async function ProductPage({ params }: PageProps<"/[locale]/products/[slug]">) {
  const { locale: l, slug } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const product = await getProduct(slug);
  if (!product) {
    const moved = await getSlugRedirect(slug);
    if (moved) permanentRedirect(localizedPath(locale, `/products/${moved}`));
    notFound();
  }

  const [t, ts, tc, related, config] = await Promise.all([
    getTranslations("pdp"),
    getTranslations("specs"),
    getTranslations("compare"),
    getProductCards({ categorySlug: product.category.slug }),
    getCheckoutConfig(),
  ]);
  const ar = locale === "ar";
  const name = ar ? product.nameAr : product.nameEn;
  const similar = related.filter((p) => p.slug !== product.slug).slice(0, 4);
  const highlights = ar ? product.highlightsAr : product.highlightsEn;
  const faqs = product.faqs.map((f) => ({ id: f.id, question: ar ? f.questionAr : f.questionEn, answer: ar ? f.answerAr : f.answerEn }));

  const trust = [
    { icon: Banknote, text: t("codNote") },
    { icon: Truck, text: t("deliveryNote", { time: ar ? config.deliveryTime.ar : config.deliveryTime.en }) },
    // 0 means the field is empty: no warranty is promised.
    ...(product.warrantyMonths > 0 ? [{ icon: ShieldCheck, text: t("warranty", { months: product.warrantyMonths }) }] : []),
    { icon: BadgeCheck, text: t("genuine") },
  ];

  return (
    // Bottom padding leaves room for the sticky mobile order bar.
    <div className="mx-auto max-w-7xl px-4 pb-28 lg:pb-16">
      <JsonLd
        data={productLd(locale, {
          slug: product.slug,
          name,
          description: ar ? product.descriptionAr : product.descriptionEn,
          brand: product.brand.name,
          images: product.images.map((i) => i.url),
          variants: product.variants,
          rating: product.rating,
          reviews: product.reviews,
        })}
      />
      {faqs.length ? <JsonLd data={faqLd(faqs)} /> : null}
      <JsonLd
        data={breadcrumbLd(locale, [
          { name: t("home"), path: "/" },
          { name: ar ? product.category.nameAr : product.category.nameEn, path: `/category/${product.category.slug}` },
          { name, path: `/products/${product.slug}` },
        ])}
      />
      <Breadcrumbs
        locale={locale}
        items={[{ href: `/category/${product.category.slug}`, label: ar ? product.category.nameAr : product.category.nameEn }, { label: name }]}
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images.map((i) => ({ url: i.url, alt: ar ? i.altAr : i.altEn }))} />

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-warm-500" dir="ltr">
              {product.brand.name}
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl">{name}</h1>
            {product.rating !== null ? (
              <a href="#reviews" className="mt-2 inline-block">
                <Rating value={product.rating} count={product.reviews.length} locale={locale} />
              </a>
            ) : null}
            {product.externalRatings.length ? (
              <div className="mt-3">
                <ul className="flex flex-col gap-1 text-sm">
                  {product.externalRatings.map((r) => (
                    <li key={r.id}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-6 items-center gap-1 font-semibold text-ink underline underline-offset-2">
                        {r.ratingCount === null ? t("externalRowNoCount", { rating: formatRating(r.rating, r.ratingMax), source: r.source }) : t("externalRow", { rating: formatRating(r.rating, r.ratingMax), source: r.source, count: formatCount(r.ratingCount) })}
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                      </a>
                      {(ar ? r.summaryAr : r.summaryEn) ? (
                        <p className="text-xs text-warm-600">
                          {t("externalSummary")} {ar ? r.summaryAr : r.summaryEn}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-warm-600">{t("externalNote")}</p>
              </div>
            ) : null}
          </div>

          <ProductPurchase
            locale={locale}
            name={name}
            config={config}
            variants={product.variants.map((v) => ({
              id: v.id,
              colorAr: v.colorAr,
              colorEn: v.colorEn,
              colorHex: v.colorHex,
              storage: v.storage,
              price: v.price,
              compareAtPrice: v.compareAtPrice,
              stock: v.stock,
            }))}
          >
            <ul className="flex flex-col gap-3 rounded-xl border border-warm-200 bg-warm-50 p-4">
              {trust.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-warm-800">
                  <Icon className="size-5 shrink-0 text-ink" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>

            <Link href="/warranty" className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-ink underline-offset-4 hover:underline">
              <ShieldCheck className="size-5" aria-hidden="true" />
              {t("policyLink")}
            </Link>

            <Link
              href={`/compare?p=${product.slug}`}
              className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-ink underline-offset-4 hover:underline"
            >
              <GitCompareArrows className="size-5" aria-hidden="true" />
              {t("addToCompare")}
            </Link>
          </ProductPurchase>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-xl">{t("description")}</h2>
          <p className="mt-3 leading-relaxed text-warm-800">{ar ? product.descriptionAr : product.descriptionEn}</p>
          {highlights.length ? (
            <ul className="mt-4 flex flex-col gap-2 text-warm-800">
              {highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <Check className="mt-1 size-4 shrink-0 text-ink" aria-hidden="true" />
                  {h}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section>
          <h2 className="text-xl">{t("specs")}</h2>
          <table className="mt-3 w-full overflow-hidden rounded-xl border border-warm-200 text-sm">
            <tbody>
              {product.specs.map((s) => (
                <tr key={s.id} className="border-b border-warm-200 last:border-0 odd:bg-warm-50">
                  <th scope="row" className="w-2/5 px-4 py-3 text-start font-semibold text-ink">
                    {ts.has(s.key) ? ts(s.key) : s.key}
                  </th>
                  <td className="px-4 py-3 text-warm-800">{ar ? s.valueAr : s.valueEn}</td>
                </tr>
              ))}
              {product.warrantyMonths > 0 ? (
                <tr>
                  <th scope="row" className="px-4 py-3 text-start font-semibold text-ink">
                    {tc("warranty")}
                  </th>
                  <td className="px-4 py-3 text-warm-800">{tc("months", { months: product.warrantyMonths })}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>

      {faqs.length ? (
        <section className="mt-12">
          <h2 className="text-xl">{t("faq")}</h2>
          <div className="mt-3 divide-y divide-warm-200 rounded-xl border border-warm-200">
            {faqs.map((f) => (
              <details key={f.id} className="group p-4">
                <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink">
                  {f.question}
                  <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-2 leading-relaxed text-warm-800">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section id="reviews" className="mt-12 scroll-mt-24">
        <h2 className="text-xl">{t("reviews")}</h2>
        {product.reviews.length && product.rating !== null ? (
          <>
            <div className="mt-3 flex items-center gap-4">
              <p className="text-4xl font-extrabold text-ink">{product.rating.toFixed(1)}</p>
              <div>
                <Rating value={product.rating} count={product.reviews.length} locale={locale} />
                <p className="text-sm text-warm-600">{t("basedOn", { count: product.reviews.length })}</p>
              </div>
            </div>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {product.reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-warm-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-ink">
                      {r.authorName}
                      {r.city ? <span className="font-normal text-warm-600"> · {r.city}</span> : null}
                    </p>
                    <span className="flex" role="img" aria-label={`${r.rating}/5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`size-4 ${i < r.rating ? "fill-yellow-500 text-yellow-700" : "fill-warm-200 text-warm-300"}`}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-success">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    {t("verifiedPurchase")}
                  </p>
                  <p className="mt-2 text-warm-800" dir="auto">
                    {r.comment}
                  </p>
                  {r.photoUrl ? (
                    <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="relative mt-2 block size-24 overflow-hidden rounded-lg bg-warm-100">
                      <Image src={r.photoUrl} alt="" fill sizes="96px" className="object-cover" />
                    </a>
                  ) : null}
                  {r.replyText ? (
                    <p className="mt-2 rounded-lg bg-warm-50 p-2.5 text-sm text-warm-800" dir="auto">
                      <span className="font-semibold text-ink">{t("storeReply")}</span> {r.replyText}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-warm-500">{dateFormat[locale].format(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-warm-600">{t("noReviews")}</p>
        )}
      </section>

      {similar.length ? (
        <section className="mt-12">
          <SectionHeader title={t("related")} locale={locale} />
          <ProductGrid products={similar} locale={locale} />
        </section>
      ) : null}
    </div>
  );
}
