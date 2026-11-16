import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { CampaignTracker } from "@/components/analytics/CampaignTracker";
import { FeatureIcon } from "@/components/landing/FeatureIcon";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cutoutUrl } from "@/lib/image-cutout";
import { SPEC_ICON } from "@/lib/landing";
import type { HomeOffer } from "@/lib/offers-data";
import { OfferSlider } from "./OfferSlider";
import { TIME_ZONE } from "@/lib/time";
import { PriceView } from "./PriceView";

// Each slide runs up behind the floating header (its margin plus its height), so the bar sits on the offer.
const UNDER_HEADER = "pt-20 md:pt-[141px] xl:pt-20";

/**
 * The week's offers at the top of the home page, as big brands do: the real end date, a large title, a line under
 * it, the price, "تسوّق الآن", and a large photo of the product. Static; several offers are swiped. Only the first
 * photo loads with priority.
 */
export async function OfferBanner({ offers, locale }: { offers: HomeOffer[]; locale: Locale }) {
  const [t, tp, ts] = await Promise.all([getTranslations("offers"), getTranslations("product"), getTranslations("specs")]);
  const ar = locale === "ar";
  const date = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { day: "numeric", month: "long", timeZone: TIME_ZONE });

  return (
    <section aria-label={t("bannerLabel")} className="relative isolate -mt-20 overflow-hidden md:-mt-[141px] xl:-mt-20">
      <CampaignTracker source="home" />
      <OfferSlider count={offers.length} label={t("bannerLabel")} slideLabels={offers.map((_, i) => t("slide", { n: i + 1, total: offers.length }))}>
        {offers.map((o, i) => {
          const dark = o.style !== "light";
          const cut = cutoutUrl(o.image.url);
          const title = ar ? o.title.ar : o.title.en;
          const subline = ar ? o.subline.ar : o.subline.en;
          const first = i === 0;
          return (
            <article
              key={o.id}
              data-index={i}
              aria-roledescription={offers.length > 1 ? "slide" : undefined}
              aria-label={offers.length > 1 ? t("slide", { n: i + 1, total: offers.length }) : undefined}
              className={`w-full shrink-0 snap-center ${UNDER_HEADER} ${dark ? "bg-linear-to-b from-deep to-ink" : "bg-linear-to-b from-warm-100 to-white"}`}
            >
              <div className={`mx-auto flex max-w-5xl flex-col items-center px-4 pt-6 pb-14 text-center md:pt-10 ${o.style === "features" ? "md:pb-16" : ""}`}>
                {o.endsAt ? (
                  <p className={`text-sm font-bold ${dark ? "text-yellow-500" : "text-ink"}`}>
                    <time dateTime={o.endsAt.toISOString()}>{t("ends", { date: date.format(o.endsAt) })}</time>
                  </p>
                ) : null}
                {first ? (
                  <h1 className={`mt-2 max-w-3xl text-3xl leading-tight md:text-5xl ${dark ? "text-white" : "text-ink"}`}>{title}</h1>
                ) : (
                  <h2 className={`mt-2 max-w-3xl text-3xl leading-tight md:text-5xl ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
                )}
                {subline ? <p className={`mt-2 max-w-2xl text-base md:text-lg ${dark ? "text-warm-300" : "text-warm-600"}`}>{subline}</p> : null}

                {o.style === "features" && o.features.length ? (
                  <ul className="mt-4 grid w-full max-w-xl grid-cols-2 gap-x-4 gap-y-3 text-start">
                    {o.features.map((f) => (
                      <li key={f.key} className="flex items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warm-900 text-yellow-500">
                          <FeatureIcon name={SPEC_ICON[f.key] ?? "sparkles"} className="size-4" />
                        </span>
                        <span className="min-w-0 leading-tight">
                          <b className="block truncate text-sm text-white">{ar ? f.valueAr : f.valueEn}</b>
                          <span className="block truncate text-xs text-warm-300">{ts.has(f.key) ? ts(f.key) : f.key}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                  <PriceView price={o.price} compareAtPrice={o.compareAtPrice} locale={locale} size="lg" tone={dark ? "onDark" : "default"} labels={{ from: tp("from"), originalPrice: tp("originalPrice") }} />
                  <Link
                    href={o.href}
                    data-track="hero_cta_click"
                    data-offer={o.id}
                    data-product={o.productId}
                    data-template={o.style}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yellow-500 px-7 text-lg font-extrabold text-ink transition-colors hover:bg-yellow-600 active:bg-yellow-700"
                  >
                    <ShoppingBag className="size-5" aria-hidden="true" />
                    {t("shopNow")}
                  </Link>
                </div>

                <div className="relative isolate mt-6 flex h-56 w-full justify-center md:h-[24rem]">
                  {dark ? <span aria-hidden="true" className="absolute inset-y-0 left-1/2 -z-10 aspect-square h-full -translate-x-1/2 rounded-full bg-radial from-warm-300/30 to-transparent to-70%" /> : null}
                  <Image
                    src={cut ?? o.image.url}
                    alt={ar ? o.image.altAr : o.image.altEn}
                    width={720}
                    height={720}
                    sizes="(min-width: 768px) 32rem, 80vw"
                    preload={first}
                    fetchPriority={first ? "high" : "low"}
                    loading={first ? "eager" : "lazy"}
                    unoptimized={o.image.url.endsWith(".svg")}
                    className={`h-full w-auto max-w-full object-contain ${cut ? (dark ? "drop-shadow-[0_18px_30px_rgb(0_0_0/0.5)]" : "drop-shadow-[0_18px_22px_rgb(17_17_17/0.18)]") : "rounded-3xl bg-white p-4"}`}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </OfferSlider>
    </section>
  );
}
