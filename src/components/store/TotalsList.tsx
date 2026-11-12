"use client";

import { Gift, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatMAD } from "@/lib/money";

/**
 * The money rows of the cart and checkout summaries: subtotal, pack and coupon savings, delivery, total,
 * and one line that adds up what the shopper saves.
 */
export function TotalsList({
  locale,
  subtotal,
  packDiscount,
  packNames,
  couponDiscount = 0,
  shipping,
  total,
}: {
  locale: Locale;
  subtotal: number;
  packDiscount: number;
  packNames: string[];
  couponDiscount?: number;
  /** null until a city is chosen. */
  shipping: number | null;
  total: number;
}) {
  const t = useTranslations("checkout");
  const money = (n: number) => formatMAD(n, locale);
  const minus = (n: number) => `−${money(n)}`;
  const saved = packDiscount + couponDiscount;

  return (
    <div className="flex flex-col gap-3">
    <dl className="flex flex-col gap-2.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-warm-600">{t("subtotal")}</dt>
        <dd className="font-semibold text-ink">{money(subtotal)}</dd>
      </div>

      {packDiscount ? (
        <div className="flex items-start justify-between gap-3">
          <dt className="flex flex-col items-start gap-1.5">
            <span className="text-warm-600">{t("packDiscount")}</span>
            <span className="flex flex-wrap gap-1.5">
              {packNames.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                  <Gift className="size-3.5" aria-hidden="true" />
                  {n}
                </span>
              ))}
            </span>
          </dt>
          <dd className="shrink-0 font-bold text-success">{minus(packDiscount)}</dd>
        </div>
      ) : null}

      {couponDiscount ? (
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-warm-600">{t("discount")}</dt>
          <dd className="font-bold text-success">{minus(couponDiscount)}</dd>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <dt className="text-warm-600">{t("shipping")}</dt>
        <dd>
          {shipping === null ? (
            <span className="text-warm-600">{t("chooseCityForShipping")}</span>
          ) : shipping === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
              <Truck className="size-3.5" aria-hidden="true" />
              {t("free")}
            </span>
          ) : (
            <span className="font-semibold text-ink">{money(shipping)}</span>
          )}
        </dd>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-warm-200 pt-3">
        <dt className="text-base font-bold text-ink">{t("total")}</dt>
        <dd className="text-2xl font-extrabold text-ink">{money(total)}</dd>
      </div>
    </dl>
      {saved ? (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-center text-sm font-semibold text-success">{t("youSave", { amount: money(saved) })}</p>
      ) : null}
    </div>
  );
}
