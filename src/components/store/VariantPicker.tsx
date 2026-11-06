"use client";

import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatMAD } from "@/lib/money";
import { PriceView } from "./PriceView";
import { StockBadge, stockMessageKey } from "./StockBadge";

export type PickerVariant = {
  id: string;
  colorAr: string | null;
  colorEn: string | null;
  colorHex: string | null;
  storage: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
};

const unique = <T,>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null))];

/** Colour / capacity choice with native radios (keyboard + shopping agents), live price and stock. */
export function VariantPicker({
  variants,
  selected,
  onSelect,
  locale,
}: {
  variants: PickerVariant[];
  selected: PickerVariant;
  onSelect: (v: PickerVariant) => void;
  locale: Locale;
}) {
  const t = useTranslations("pdp");
  const tp = useTranslations("product");

  const colors = unique(variants.map((v) => v.colorEn));
  const storages = unique(variants.map((v) => v.storage));

  // Keep the other attribute when possible; otherwise fall back to the first variant with the new value.
  // Prefers an in-stock match for the new value.
  const pick = (attr: "colorEn" | "storage", value: string) => {
    const other = attr === "colorEn" ? "storage" : "colorEn";
    const withValue = variants.filter((v) => v[attr] === value);
    onSelect(
      withValue.find((v) => v[other] === selected[other] && v.stock > 0) ??
        withValue.find((v) => v.stock > 0) ??
        withValue.find((v) => v[other] === selected[other]) ??
        withValue[0] ??
        selected,
    );
  };
  const stockFor = (attr: "colorEn" | "storage", value: string) => variants.filter((v) => v[attr] === value).reduce((s, v) => s + v.stock, 0);

  const optionClass = (active: boolean) =>
    `flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-yellow-300 ${
      active ? "border-ink bg-yellow-100 text-yellow-900" : "border-warm-200 bg-white text-ink hover:border-warm-300"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <PriceView
          price={selected.price}
          compareAtPrice={selected.compareAtPrice}
          locale={locale}
          size="lg"
          labels={{ from: tp("from"), originalPrice: tp("originalPrice") }}
        />
        <div aria-live="polite">
          <StockBadge stock={selected.stock} label={tp(stockMessageKey(selected.stock), { count: selected.stock })} />
        </div>
      </div>

      {colors.length > 1 || (colors.length === 1 && storages.length <= 1) ? (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">
            {t("color")}: <span className="font-normal text-warm-600">{locale === "ar" ? selected.colorAr : selected.colorEn}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const v = variants.find((x) => x.colorEn === c)!;
              const label = (locale === "ar" ? v.colorAr : v.colorEn) ?? c;
              // A sold-out colour stays visible (struck through) but cannot be chosen.
              const soldOut = stockFor("colorEn", c) <= 0;
              return (
                <label
                  key={c}
                  className={`${optionClass(selected.colorEn === c)} ${soldOut ? "cursor-not-allowed border-dashed bg-warm-50 text-warm-500 hover:border-warm-200" : ""}`}
                >
                  <input
                    type="radio"
                    name="color"
                    value={c}
                    checked={selected.colorEn === c}
                    disabled={soldOut}
                    aria-label={soldOut ? t("soldOutOption", { label }) : label}
                    onChange={() => pick("colorEn", c)}
                    className="sr-only"
                  />
                  {v.colorHex ? (
                    <span className={`relative size-5 overflow-hidden rounded-full border border-warm-300 ${soldOut ? "opacity-50" : ""}`} style={{ backgroundColor: v.colorHex }} aria-hidden="true">
                      {soldOut ? <span className="absolute inset-x-[-2px] top-1/2 h-0.5 -translate-y-1/2 -rotate-45 bg-warm-600" /> : null}
                    </span>
                  ) : null}
                  <span className={soldOut ? "line-through decoration-2" : ""} aria-hidden="true">
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {storages.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">{t("storage")}</legend>
          <div className="flex flex-wrap gap-2">
            {storages.map((s) => {
              const v = variants.find((x) => x.storage === s && x.colorEn === selected.colorEn) ?? variants.find((x) => x.storage === s)!;
              return (
                <label key={s} className={optionClass(selected.storage === s)}>
                  <input type="radio" name="storage" value={s} checked={selected.storage === s} onChange={() => pick("storage", s)} className="sr-only" />
                  <span dir="ltr">{s}</span>
                  {storages.length > 1 ? <span className="font-normal text-warm-600">{formatMAD(v.price, locale)}</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
