"use client";

import { Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatMAD } from "@/lib/money";

/**
 * How far the order is from free delivery: a yellow rail with a truck at the shopper's amount and the goal at
 * its end. The goal comes from the settings; `spent` must be the amount the delivery fee is decided on.
 */
export function FreeDeliveryRail({ spent, threshold, locale }: { spent: number; threshold: number; locale: Locale }) {
  const t = useTranslations("checkout");
  if (threshold <= 0) return null;

  const missing = threshold - spent;
  const reached = missing <= 0;
  const percent = Math.min(100, Math.max(0, (spent / threshold) * 100));

  return (
    <div className="mt-4 border-t border-warm-200 pt-3">
      <p className={`text-sm font-semibold ${reached ? "text-success" : "text-ink"}`}>
        {reached ? t("freeShippingReached") : t("freeShippingHint", { amount: formatMAD(missing, locale) })}
      </p>
      <div aria-hidden="true" className="relative mt-3 h-7">
        <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-warm-200">
          <span className="absolute inset-y-0 start-0 rounded-full bg-yellow-500 transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
        </span>
        <span
          className="absolute top-0 grid size-7 place-items-center rounded-full bg-ink text-yellow-500 transition-[inset-inline-start] duration-500 ease-out"
          style={{ insetInlineStart: `clamp(0px, calc(${percent}% - 0.875rem), calc(100% - 1.75rem))` }}
        >
          <Truck className="size-4 rtl:-scale-x-100" />
        </span>
      </div>
      <div className="mt-1 flex justify-between text-xs text-warm-600">
        <span>{formatMAD(spent, locale)}</span>
        <span className="font-semibold text-ink">{formatMAD(threshold, locale)}</span>
      </div>
    </div>
  );
}
