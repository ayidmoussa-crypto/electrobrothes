import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { BrandStrip } from "@/components/store/BrandStrip";
import { CategoryIcon } from "@/components/store/CategoryIcon";
import { CategoryTabs } from "@/components/store/CategoryTabs";
import { Countdown } from "@/components/store/Countdown";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductGrid, SectionHeader } from "@/components/store/ProductGrid";
import { ProductSlider } from "@/components/store/ProductSlider";
import { TrustBar } from "@/components/store/TrustBar";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getActiveDeals, getBrands, getCategories, getProductCards, getTestimonials } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { organizationLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/seo/JsonLd";
import type { Metadata } from "next";
// Canva Pro photo, 2400 × 1350 mozjpeg (~150 KB); next/image serves AVIF/WebP at the viewport width.
import heroPhoto from "@/assets/hero.jpg";

async function Hero() {
  const [t, products] = await Promise.all([getTranslations("home"), getProductCards()]);
  const hero = products.find((p) => p.isFeatured && p.dealEndsAt) ?? products.find((p) => p.isFeatured) ?? products[0];

  return (
    // Slides 1.5rem up under the header so its rounded bottom corners sit on the dark hero, not on white.
    <section className="relative isolate -mt-6 overflow-hidden bg-ink pt-6">
      {/* Store photo, full bleed. The products sit opposite the text: on the left in Arabic, mirrored for English. */}
      <Image
        src={heroPhoto}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        quality={75}
        className="-z-20 object-cover object-left ltr:-scale-x-100"
      />
      {/* Ink veil from the text side so the copy reads on any part of the photo (heavier on phones, where text covers it). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-ink/70 md:bg-transparent md:from-ink md:via-ink/80 md:to-ink/10 md:ltr:bg-linear-to-r md:rtl:bg-linear-to-l"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-linear-to-t from-ink to-transparent" />

      <div className="mx-auto flex min-h-[28rem] max-w-7xl items-center px-4 py-14 md:min-h-[34rem] md:py-20">
        <div className="max-w-xl">
          <Badge tone="accent" className="text-sm">
            {t("heroEyebrow")}
          </Badge>
          <h1 className="mt-4 text-4xl text-white md:text-5xl">{t("heroTitle")}</h1>
          <p className="mt-4 text-lg text-warm-300">{t("heroSubtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {hero ? (
              <Link href={`/products/${hero.slug}`} className={buttonClass({ size: "lg" })}>
                {t("heroCta")}
              </Link>
            ) : null}
            <a href="#categories" className={buttonClass({ variant: "outlineDark", size: "lg" })}>
              {t("heroSecondary")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

async function Categories({ locale }: { locale: Locale }) {
  const [t, categories] = await Promise.all([getTranslations("home"), getCategories()]);
  return (
    <section id="categories" className="mx-auto max-w-7xl scroll-mt-4 px-4 py-12">
      <SectionHeader title={t("categoriesTitle")} locale={locale} />
      {/*
        Round categories with a grey line icon of the product. Hover/focus: the disc turns ink, the icon brand
        yellow, and it lifts on a soft neutral shadow. Phones swipe (native scroll + snap); from md the five
        sit in one row.
      */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pt-3 pb-2 [scrollbar-width:none] sm:gap-6 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => (
          <li key={c.slug} className="shrink-0 snap-start">
            <Link
              href={`/category/${c.slug}`}
              // Keyboard focus is shown on the round disc (ink + yellow + Yellow 300 ring), not as a box around the whole link.
              className="group flex w-24 flex-col items-center gap-3 text-center focus-visible:shadow-none focus-visible:outline-none sm:w-32 md:w-full"
            >
              <span className="grid size-20 place-items-center rounded-full border border-warm-200 bg-warm-50 text-warm-500 shadow-sm shadow-ink/5 transition-[background-color,border-color,color,translate,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:border-ink group-hover:bg-ink group-hover:text-yellow-500 group-hover:shadow-xl group-hover:shadow-ink/20 group-focus-visible:border-ink group-focus-visible:bg-ink group-focus-visible:text-yellow-500 group-focus-visible:ring-3 group-focus-visible:ring-yellow-300 group-focus-visible:ring-offset-2 sm:size-28">
                <CategoryIcon slug={c.slug} className="size-9 transition-transform duration-300 group-hover:scale-110 sm:size-11" />
              </span>
              <span className="text-sm font-bold text-ink sm:text-base">{locale === "ar" ? c.nameAr : c.nameEn}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function BestSellers({ locale }: { locale: Locale }) {
  const [t, tl, products] = await Promise.all([
    getTranslations("home"),
    getTranslations("listing"),
    getProductCards({ bestSellers: true, take: 8 }),
  ]);
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <SectionHeader title={t("bestSellersTitle")} href="/search?sort=rating" linkLabel={t("viewAll")} locale={locale} />
      {/* One swipeable row instead of a two-row grid, so the home page stays short. */}
      <ProductSlider label={t("bestSellersTitle")} prevLabel={tl("previous")} nextLabel={tl("next")}>
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} locale={locale} />
        ))}
      </ProductSlider>
    </section>
  );
}

/** One product slider per category behind a pill switcher; categories with no products are skipped. */
async function ShopByCategory({ locale }: { locale: Locale }) {
  const [t, tl, categories] = await Promise.all([getTranslations("home"), getTranslations("listing"), getCategories()]);
  const withProducts = await Promise.all(categories.map(async (c) => ({ c, products: await getProductCards({ categorySlug: c.slug, take: 8 }) })));
  const Arrow = locale === "ar" ? ChevronLeft : ChevronRight;

  const tabs = withProducts
    .filter(({ products }) => products.length)
    .map(({ c, products }) => {
      const name = locale === "ar" ? c.nameAr : c.nameEn;
      return {
        slug: c.slug,
        label: name,
        panel: (
          <>
            <ProductSlider label={name} prevLabel={tl("previous")} nextLabel={tl("next")}>
              {products.map((p) => (
                <ProductCard key={p.slug} product={p} locale={locale} />
              ))}
            </ProductSlider>
            <Link
              href={`/category/${c.slug}`}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold text-warm-600 underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {t("tabsViewAll", { name })}
              <Arrow className="size-4" aria-hidden="true" />
            </Link>
          </>
        ),
      };
    });
  if (!tabs.length) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="rounded-[2rem] border border-warm-200 bg-warm-50 px-3 py-5 sm:p-8">
        <div className="mb-2">
          <h2 className="text-2xl md:text-3xl">{t("tabsTitle")}</h2>
          <p className="mt-1 mb-5 text-warm-600">{t("tabsSubtitle")}</p>
        </div>
        <CategoryTabs tabs={tabs} label={t("tabsTitle")} />
      </div>
    </section>
  );
}

/** Depends on the current time, so it streams in at request time. */
async function Deals({ locale }: { locale: Locale }) {
  const [t, deals] = await Promise.all([getTranslations("home"), getActiveDeals()]);
  if (!deals.length) return null;
  const firstEnd = deals[0].dealEndsAt!;

  return (
    <section className="bg-yellow-50">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <SectionHeader
          title={t("dealsTitle")}
          subtitle={t("dealsSubtitle")}
          locale={locale}
          aside={
            // Limited-deal card: dark glass over a blurred yellow glow; the timer tiles stay solid ink.
            <div className="relative isolate">
              <div aria-hidden="true" className="pointer-events-none absolute inset-4 -z-10 rounded-full bg-yellow-500/60 blur-2xl" />
              <div className="glass-dark flex flex-col gap-2 rounded-glass border p-4">
                <span className="text-sm font-semibold text-white">{t("endsIn")}</span>
                <Countdown endsAt={firstEnd.toISOString()} tone="glass" />
              </div>
            </div>
          }
        />
        <ProductGrid products={deals} locale={locale} />
      </div>
    </section>
  );
}

async function Brands() {
  const [t, brands] = await Promise.all([getTranslations("home"), getBrands()]);
  return (
    <section className="border-y border-warm-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="mb-4 text-center text-xl">{t("brandsTitle")}</h2>
        <BrandStrip brands={brands} />
      </div>
    </section>
  );
}

async function Testimonials({ locale }: { locale: Locale }) {
  const [t, reviews] = await Promise.all([getTranslations("home"), getTestimonials()]);
  if (!reviews.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <SectionHeader title={t("testimonialsTitle")} locale={locale} />
      <ul className="grid gap-4 md:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.id}>
            <figure className="flex h-full flex-col rounded-xl border border-warm-200 bg-white p-5">
              <Quote className="size-6 text-warm-300" aria-hidden="true" />
              <blockquote className="mt-2 flex-1 text-warm-800">{r.comment}</blockquote>
              <figcaption className="mt-4 border-t border-warm-200 pt-3">
                <span className="flex items-center gap-1" aria-hidden="true">
                  {Array.from({ length: r.rating }, (_, i) => (
                    <Star key={i} className="size-4 fill-yellow-500 text-yellow-700" />
                  ))}
                </span>
                <span className="mt-1 block font-bold text-ink">
                  {r.authorName}
                  {r.city ? <span className="font-normal text-warm-600"> · {r.city}</span> : null}
                </span>
                <span className="block text-sm text-warm-600">
                  {t("bought", { product: locale === "ar" ? r.product.nameAr : r.product.nameEn })}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "meta" });
  // The home title already carries the brand, so it skips the "%s | ElectroBrothers" template.
  return { ...pageMetadata({ locale, path: "/", title: t("title"), description: t("description") }), title: { absolute: t("title") } };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("product");

  return (
    <>
      <JsonLd data={organizationLd(locale)} />
      <Hero />
      <TrustBar />
      <Categories locale={locale} />
      <BestSellers locale={locale} />
      <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12"><ProductGridSkeleton count={4} label={t("loading")} /></div>}>
        <Deals locale={locale} />
      </Suspense>
      <Brands />
      <ShopByCategory locale={locale} />
      <Testimonials locale={locale} />
    </>
  );
}
