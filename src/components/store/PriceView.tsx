import type { Locale } from "@/i18n/routing";
import { formatMAD } from "@/lib/money";

// Shared by server (<Price>) and client (VariantPicker) components: no server-only imports here.

export const discountPercent = (price: number, compareAt: number | null) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

export type PriceProps = {
  price: number;
  compareAtPrice?: number | null;
  from?: boolean;
  locale: Locale;
  size?: "md" | "lg";
  /** "onDark": white price for the dark hero (no glass on the price itself). */
  tone?: "default" | "onDark";
};

/** Current price in ink, original struck in warm-500. Never yellow on white. */
export function PriceView({
  price,
  compareAtPrice,
  from = false,
  locale,
  size = "md",
  tone = "default",
  labels,
}: PriceProps & { labels: { from: string; originalPrice: string } }) {
  const onSale = discountPercent(price, compareAtPrice ?? null) > 0;
  const dark = tone === "onDark";
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-extrabold ${dark ? "text-white" : "text-ink"} ${size === "lg" ? "text-3xl" : "text-lg"}`}>
        {from ? <span className={`me-1 text-sm font-medium ${dark ? "text-white" : "text-warm-600"}`}>{labels.from}</span> : null}
        {formatMAD(price, locale)}
      </span>
      {onSale ? (
        <span className={`line-through ${dark ? "text-white" : "text-warm-500"} ${size === "lg" ? "text-lg" : "text-sm"}`}>
          <span className="sr-only">{labels.originalPrice} </span>
          {formatMAD(compareAtPrice!, locale)}
        </span>
      ) : null}
    </p>
  );
}
