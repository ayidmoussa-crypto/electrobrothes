import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

/**
 * "compact" (product cards): one star + "4.7 (3)". Five SVG stars per card made the
 * home page HTML ~40% heavier. "full" (product page): five stars.
 */
export async function Rating({ value, count, locale, variant = "full" }: { value: number; count: number; locale: Locale; variant?: "full" | "compact" }) {
  const t = await getTranslations({ locale, namespace: "product" });
  const rounded = Math.round(value);
  const label = t("ratingLabel", { value: value.toFixed(1), count });

  return (
    <p className="flex items-center gap-1 text-xs text-warm-600">
      <span className="flex" aria-hidden="true">
        {(variant === "compact" ? [1] : [1, 2, 3, 4, 5]).map((i) => (
          <Star
            key={i}
            className={`size-3.5 ${variant === "compact" || i <= rounded ? "fill-yellow-500 text-yellow-700" : "fill-warm-200 text-warm-300"}`}
          />
        ))}
      </span>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" dir="ltr">
        {value.toFixed(1)} ({count})
      </span>
    </p>
  );
}
