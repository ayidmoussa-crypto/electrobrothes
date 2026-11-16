import { ArrowLeft, ArrowRight, BadgeCheck, ShoppingCart } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getHeroProduct } from "@/lib/catalog";
import { cutoutUrl } from "@/lib/image-cutout";
import { orderRequestText, whatsappLink } from "@/lib/order-whatsapp";
import { getCheckoutConfig } from "@/lib/store-config";
import { PriceView } from "./PriceView";
import { WhatsAppGlyph } from "./WhatsAppButton";

// Runs up behind the floating header (its margin plus its height), so the bar sits on the dark hero.
const SECTION = "relative isolate -mt-20 overflow-hidden bg-linear-to-b from-deep to-ink pt-20 md:-mt-[141px] md:pt-[141px] xl:-mt-20 xl:pt-20";
const ORDER_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yellow-500 px-6 font-extrabold text-ink transition-colors duration-150 hover:bg-yellow-600 active:bg-yellow-700";

/**
 * The home page hero: one real product of the week (Settings), its photo, name, price and two ways to order, then the
 * shop's promises. Static on purpose: no animation, no carousel, the photo loads first. Without any product on sale it
 * falls back to the shop's own title and a link to the categories.
 */
export async function HeroOffer({ locale }: { locale: Locale }) {
  const [t, tp, hero, config] = await Promise.all([getTranslations("home"), getTranslations("product"), getHeroProduct(), getCheckoutConfig()]);
  const ar = locale === "ar";

  if (!hero) {
    const Arrow = ar ? ArrowLeft : ArrowRight;
    return (
      <section className={SECTION}>
        <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
          <h1 className="max-w-xl text-4xl text-white md:text-5xl">{t("heroTitle")}</h1>
          <p className="mt-4 max-w-xl text-lg text-warm-300">{t("heroSubtitle")}</p>
          <a href="#categories" className={`${ORDER_BUTTON} mt-8`}>
            {t("heroSecondary")}
            <Arrow className="size-5" aria-hidden="true" />
          </a>
        </div>
      </section>
    );
  }

  const name = ar ? hero.nameAr : hero.nameEn;
  const headline = ar ? hero.headline.ar : hero.headline.en;
  const cut = cutoutUrl(hero.image.url);
  const whatsapp = config.whatsappNumber.replace(/\D/g, "");
  const deliveryTime = ar ? config.deliveryTime.ar : config.deliveryTime.en;
  const endDate = hero.dealEndsAt
    ? new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { day: "numeric", month: "long", timeZone: "Africa/Casablanca" }).format(hero.dealEndsAt)
    : null;
  const trust = [t("heroTrustCod"), hero.hasWarranty && t("heroTrustWarranty"), deliveryTime && t("heroTrustDelivery", { time: deliveryTime }), t("heroTrustCall")].filter(Boolean) as string[];

  return (
    <section className={SECTION}>
      {/* Phones: pill, photo, then the rest, all in the first screen. From md: the text beside the photo. */}
      <div className="mx-auto grid max-w-7xl gap-x-12 px-4 pt-4 pb-6 [grid-template-areas:'pill'_'img'_'info'] md:grid-cols-2 md:py-14 md:[grid-template-areas:'pill_img'_'info_img']">
        <p className="inline-flex items-center gap-1.5 self-end justify-self-start rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-ink [grid-area:pill]">
          {t("heroEyebrow")}
          {endDate ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={hero.dealEndsAt!.toISOString()}>{t("heroEnds", { date: endDate })}</time>
            </>
          ) : null}
        </p>

        <div className="relative isolate mx-auto my-3 flex h-52 w-full max-w-xs justify-center [grid-area:img] md:my-0 md:h-[26rem] md:max-w-md">
          {/* A still, soft light behind the product, so a black one does not vanish into the dark. */}
          <span aria-hidden="true" className="absolute inset-y-0 left-1/2 -z-10 aspect-square h-full -translate-x-1/2 rounded-full bg-radial from-warm-300/35 to-transparent to-70%" />
          <Image
            src={cut ?? hero.image.url}
            alt={ar ? hero.image.altAr : hero.image.altEn}
            width={480}
            height={480}
            sizes="(min-width: 768px) 28rem, 70vw"
            preload
            fetchPriority="high"
            loading="eager"
            unoptimized={hero.image.url.endsWith(".svg")}
            // A cut-out stands on the dark; a photo with its own background sits on a white tile.
            className={`h-full w-auto max-w-full object-contain ${cut ?"drop-shadow-[0_18px_30px_rgb(0_0_0/0.5)]" : "rounded-3xl bg-white p-4"}`}
          />
        </div>

        <div className="self-start [grid-area:info]">
          <h1 className="text-2xl text-white md:mt-4 md:text-4xl">{headline ?? name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-warm-300">
            {headline ? <span className="font-semibold">{name}</span> : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-warm-700 px-2.5 py-0.5 text-sm font-bold text-white">
              <BadgeCheck className="size-4 text-yellow-500" aria-hidden="true" />
              {t("heroGenuine")}
            </span>
          </p>

          <div className="mt-3">
            <PriceView price={hero.price} compareAtPrice={hero.compareAtPrice} locale={locale} size="lg" tone="onDark" labels={{ from: tp("from"), originalPrice: tp("originalPrice") }} />
          </div>

          <div className="mt-4 flex gap-3">
            <Link href={`/products/${hero.slug}`} className={`${ORDER_BUTTON} flex-1 sm:flex-none`}>
              <ShoppingCart className="size-5" aria-hidden="true" />
              {t("heroCta")}
            </Link>
            {whatsapp ? (
              <a
                href={whatsappLink(whatsapp, orderRequestText(name, hero.price))}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("heroWhatsappLabel", { name })}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-warm-700 px-5 font-bold text-white transition-colors duration-150 hover:border-whatsapp hover:bg-white/5"
              >
                <WhatsAppGlyph className="size-5 text-whatsapp" />
                {t("heroWhatsapp")}
              </a>
            ) : null}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-sm text-warm-300">
            {trust.map((item, i) => (
              <li key={item} className="flex items-center gap-2">
                {i ? <span aria-hidden="true">·</span> : null}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
