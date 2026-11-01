import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/catalog";
import { discountPercent, Price } from "./Price";
import { Rating } from "./Rating";
import { StockStatus } from "./StockStatus";

export async function ProductCard({
  product: p,
  locale,
  priority = false,
}: {
  product: ProductCardData;
  locale: Locale;
  priority?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "product" });
  const name = locale === "ar" ? p.nameAr : p.nameEn;
  const off = discountPercent(p.minPrice, p.compareAtPrice);
  const soldOut = p.stock <= 0;

  // At most two badges, by priority: sold out > discount > limited deal > best seller.
  const badges = [
    soldOut && <Badge key="out" tone="ink">{t("outOfStock")}</Badge>,
    off > 0 && (
      <Badge key="off" tone="danger" className="text-sm">
        <bdi dir="ltr">{`−${off}%`}</bdi>
      </Badge>
    ),
    p.dealEndsAt && <Badge key="deal" tone="accent">{t("limitedDeal")}</Badge>,
    p.isBestSeller && <Badge key="best" tone="accent">{t("bestSeller")}</Badge>,
  ]
    .filter(Boolean)
    .slice(0, 2);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-warm-200 bg-white transition-shadow duration-200 hover:shadow-lg hover:shadow-ink/5">
      <div className="relative aspect-square bg-warm-50">
        {p.image ? (
          <Image
            src={p.image.url}
            alt={locale === "ar" ? p.image.altAr : p.image.altEn}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            unoptimized={p.image.url.endsWith(".svg")}
            className={`object-contain p-4 transition-transform duration-300 group-hover:scale-105 ${soldOut ? "opacity-50" : ""}`}
          />
        ) : null}
        {badges.length ? <div className="absolute start-2 top-2 flex flex-col items-start gap-1">{badges}</div> : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-warm-500" dir="ltr">
          {p.brand}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold text-ink sm:text-base">
          {/* Stretched link: the whole card is clickable, one tab stop. */}
          <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {name}
          </Link>
        </h3>
        {p.rating !== null ? <Rating value={p.rating} count={p.reviewCount} locale={locale} variant="compact" /> : null}
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Price price={p.minPrice} compareAtPrice={p.compareAtPrice} from={p.maxPrice > p.minPrice} locale={locale} />
          {soldOut ? null : <StockStatus stock={p.stock} locale={locale} />}
        </div>
      </div>
    </article>
  );
}
