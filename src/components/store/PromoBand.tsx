import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getPromoProducts } from "@/lib/catalog";
import { NightSky } from "./NightSky";
import { discountPercent } from "./PriceView";
import { PromoScroll } from "./PromoScroll";

// The bolt from the logo (see brand/Logo.tsx), redrawn on its own.
const BOLT = "M1151 479L1020 869L1200 874L815 1377L935 997H752Z";

/**
 * Full-width band between the brands and the categories: a window onto a still background the page slides over,
 * with the store's real biggest discount charging up like a battery as you scroll. No products, one action.
 * The number and the count come from the catalogue, so the band disappears when nothing is on sale.
 */
export async function PromoBand({ locale }: { locale: Locale }) {
  const [t, products] = await Promise.all([getTranslations("home"), getPromoProducts()]);
  if (!products.length) return null;

  const best = Math.max(...products.map((p) => discountPercent(p.minPrice, p.compareAtPrice)));
  const number = `−${best}%`;
  const word = t("promoWord");
  const ghost = Array.from({ length: 6 }, () => t("promoGhost")).join(" ");
  // The arrow sits before the label and points at it: the hover fill runs the same way.
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;

  return (
    <PromoScroll labelledBy="promo-title" className="promo relative isolate overflow-hidden bg-ink">
      {/* The still background seen through the band: it stays put while the page moves over it. */}
      <div aria-hidden="true" className="promo-bg">
        {/* The same starry sky as the hero and the packs, still behind the sliding words. */}
        <NightSky />
        <p className="promo-ghost promo-ghost-a">{ghost}</p>
        <p className="promo-ghost promo-ghost-b">{ghost}</p>
        <svg viewBox="700 440 560 980" className="promo-bolt">
          <path d={BOLT} className="promo-bolt-fill" />
          <path d={BOLT} pathLength={1} className="promo-bolt-line" />
          <path d={BOLT} pathLength={1} className="promo-bolt-spark" />
        </svg>
      </div>

      <div className="relative mx-auto grid min-h-[40rem] max-w-7xl items-center gap-10 px-4 py-16 md:min-h-[42rem] md:grid-cols-[1.1fr_0.9fr] md:gap-8 md:py-24">
        <div>
          <h2 id="promo-title" aria-label={t("promoTitle")} className="text-[2.75rem] leading-[1.15] text-white md:text-6xl md:leading-[1.15]">
            {t("promoTitle")
              .split(" ")
              .map((w, i) => (
                <Fragment key={i}>
                  <span aria-hidden="true" className="promo-word" style={{ "--i": i } as React.CSSProperties}>
                    <span className="promo-word-in">
                      {w === word ? (
                        <span className="promo-mark">
                          {w}
                          <span className="promo-mark-on">{w}</span>
                        </span>
                      ) : (
                        w
                      )}
                    </span>
                  </span>{" "}
                </Fragment>
              ))}
          </h2>
          <p className="promo-fade mt-5 max-w-md text-lg text-warm-300">{t("promoSubtitle")}</p>
          <Link href="/promotions" className="promo-cta mt-9">
            <span className="promo-cta-arrow" aria-hidden="true">
              <Arrow className="size-6" />
            </span>
            <span className="promo-cta-label">{t("promoCta")}</span>
          </Link>
        </div>

        <div className="promo-fade">
          <p className="text-xl font-extrabold text-white">{t("promoUpTo")}</p>
          {/* Latin digits read left to right in both languages; the gauge rises with the number. */}
          <div dir="ltr" className="promo-meter mt-1 flex items-stretch gap-3 md:gap-4 rtl:justify-end">
            <span aria-hidden="true" className="promo-gauge" />
            <p className="promo-number">
              <span className="sr-only">{number}</span>
              <span aria-hidden="true" className="promo-number-off">
                {number}
              </span>
              <span aria-hidden="true" className="promo-number-on">
                {number}
              </span>
            </p>
          </div>
          <p className="mt-3 font-semibold text-warm-300">{t("promoCount", { count: products.length })}</p>
        </div>
      </div>
    </PromoScroll>
  );
}
