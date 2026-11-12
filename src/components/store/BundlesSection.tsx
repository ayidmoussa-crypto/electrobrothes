import { ArrowLeft, ArrowRight, Package } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getBundles } from "@/lib/bundles-data";
import { cutoutUrl } from "@/lib/image-cutout";
import { BundleCard } from "./BundleCard";
import { NightSky } from "./NightSky";
import { ProductSlider } from "./ProductSlider";

/**
 * Home page packs: one black frame. The start side holds the title and a picture of a pack (its own photo,
 * or three of its products stacked like a gift box); the wider side is a row of pack cards to swipe.
 */
export async function BundlesSection({ locale }: { locale: Locale }) {
  const [t, tl, bundles] = await Promise.all([getTranslations("bundles"), getTranslations("listing"), getBundles()]);
  if (!bundles.length) return null;
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;

  const cover = bundles.find((b) => b.image);
  // Three different products: the same charger can sit in several packs.
  const stack = [...new Map(bundles.flatMap((b) => b.items).filter((i) => i.image).map((i) => [i.productId, i])).values()].slice(0, 3);

  return (
    <section aria-labelledby="packs-title" className="mx-auto max-w-7xl px-4 py-12">
      <div className="relative isolate rounded-[2rem] bg-ink p-4 sm:p-6 lg:grid lg:grid-cols-[17rem_1fr] lg:gap-6 lg:p-8">
        {/* The same starry sky as the hero, so the black blocks of the home page belong together. */}
        <NightSky />

        <div className="relative z-10 flex items-center gap-4 lg:flex-col lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 lg:flex-none">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-ink">
              <Package className="size-4" aria-hidden="true" />
              {t("eyebrow")}
            </span>
            <h2 id="packs-title" className="mt-3 text-2xl text-white md:text-3xl">
              {t("homeTitle")}
            </h2>
            <p className="mt-2 text-sm text-warm-300 max-sm:hidden">{t("subtitle")}</p>
            <Link
              href="/bundles"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold text-white underline-offset-4 transition-colors hover:text-yellow-500 hover:underline"
            >
              {t("viewAll")}
              <Arrow className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div aria-hidden="true" className="relative size-28 shrink-0 sm:size-36 lg:mt-6 lg:size-60 lg:self-center">
            {cover ? (
              <PackPhoto src={cover.image!} className="inset-0" sizes="240px" />
            ) : (
              stack.map((i, n) => (
                <PackPhoto
                  key={i.productId}
                  src={i.image!.url}
                  sizes="150px"
                  className={`size-[62%] ${["start-0 top-[6%] -rotate-12", "end-0 top-0 rotate-6", "start-[19%] bottom-0 z-10 -rotate-2"][n]}`}
                />
              ))
            )}
          </div>
        </div>

        {/* Its own layer above the animated sky: iPhone Safari otherwise loses the row's swipe area and
            hands sideways swipes to the page. */}
        <div className="relative z-10 mt-6 min-w-0 lg:mt-0">
          <ProductSlider
            label={t("title")}
            prevLabel={tl("previous")}
            nextLabel={tl("next")}
            itemClassName="w-[78%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
          >
            {bundles.map((b) => (
              <BundleCard key={b.id} bundle={b} locale={locale} />
            ))}
          </ProductSlider>
        </div>
      </div>
    </section>
  );
}

/**
 * A product floating on the black with its white studio background cut out (lib/image-cutout.ts), lit by a faint
 * glow so dark products still read. A photo that cannot be cut out keeps its white tile.
 */
function PackPhoto({ src, className, sizes }: { src: string; className: string; sizes: string }) {
  const cutout = cutoutUrl(src);
  return cutout ? (
    <div className={`absolute ${className}`}>
      <Image src={cutout} alt="" fill sizes={sizes} className="object-contain drop-shadow-[0_0_22px_rgb(255_255_255/0.16)]" />
    </div>
  ) : (
    <div className={`absolute overflow-hidden rounded-2xl bg-white shadow-xl shadow-deep/60 ${className}`}>
      <Image src={src} alt="" fill sizes={sizes} unoptimized={src.endsWith(".svg")} className="object-contain p-2" />
    </div>
  );
}
