import { Flame } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/catalog";
import { discountPercent, Price } from "./Price";
import { QuickAdd } from "./QuickAdd";
import { Rating } from "./Rating";
import { LOW_STOCK, stockMessageKey } from "./StockBadge";

export async function ProductCard({
  product: p,
  locale,
  priority = false,
}: {
  product: ProductCardData;
  locale: Locale;
  priority?: boolean;
}) {
  const [t, tc] = await Promise.all([getTranslations({ locale, namespace: "product" }), getTranslations({ locale, namespace: "cart" })]);
  const name = locale === "ar" ? p.nameAr : p.nameEn;
  const href = `/products/${p.slug}`;
  const off = discountPercent(p.minPrice, p.compareAtPrice);
  const soldOut = p.stock <= 0;
  const low = !soldOut && p.stock <= LOW_STOCK;

  // At most two badges, by priority: sold out > discount > limited deal > best seller.
  const badges = [
    soldOut && <Badge key="out" tone="ink">{t("outOfStock")}</Badge>,
    off > 0 && (
      <Badge key="off" tone="danger" className="text-sm">
        <bdi dir="ltr">{`−${off}%`}</bdi>
      </Badge>
    ),
    p.dealEndsAt && <Badge key="deal" tone="accent">{t("limitedDeal")}</Badge>,
    p.isBestSeller && (
      <Badge key="best" tone="ink" icon={<Flame className="size-3.5 text-yellow-500" aria-hidden="true" />}>
        {t("bestSeller")}
      </Badge>
    ),
  ]
    .filter(Boolean)
    .slice(0, 2);

  return (
    // h-full: every card in a row ends on the same line, whatever the length of its name.
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-warm-200 transition-shadow duration-200 hover:shadow-lg hover:shadow-ink/10">
      <div className="relative aspect-square bg-warm-100">
        {p.image ? (
          <Image
            src={p.image.url}
            alt={locale === "ar" ? p.image.altAr : p.image.altEn}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            unoptimized={p.image.url.endsWith(".svg")}
            className={`object-contain p-5 mix-blend-multiply transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none sm:p-6 ${soldOut ? "opacity-50" : ""}`}
          />
        ) : null}
        {badges.length ? <div className="absolute start-2.5 top-2.5 flex flex-col items-start gap-1">{badges}</div> : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-warm-500" dir="ltr">
          {p.brand}
        </p>
        <h3 className="line-clamp-2 text-sm leading-snug font-bold text-ink sm:text-base">
          {/* Stretched link: the whole card is clickable, one tab stop. */}
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {name}
          </Link>
        </h3>
        {p.rating !== null ? <Rating value={p.rating} count={p.reviewCount} locale={locale} variant="compact" /> : null}

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <Price price={p.minPrice} compareAtPrice={p.compareAtPrice} from={p.maxPrice > p.minPrice} locale={locale} />
            {soldOut ? null : (
              // Dot + words, never colour alone.
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${low ? "text-warning-text" : "text-success"}`}>
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${low ? "bg-warning" : "bg-success"}`} />
                {t(stockMessageKey(p.stock), { count: p.stock })}
              </span>
            )}
          </div>
          <QuickAdd
            variantId={p.quickAddId}
            href={href}
            name={name}
            price={p.minPrice}
            soldOut={soldOut}
            labels={{ add: tc("addToCart"), choose: t("chooseOptions"), soldOut: t("outOfStock") }}
          />
        </div>
      </div>
    </article>
  );
}
