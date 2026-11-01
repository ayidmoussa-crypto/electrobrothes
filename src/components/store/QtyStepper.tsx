"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export function QtyStepper({ value, max, onChange, id }: { value: number; max: number; onChange: (n: number) => void; id: string }) {
  const t = useTranslations("cart");
  const btn =
    "grid size-11 cursor-pointer place-items-center text-ink transition-colors hover:bg-warm-100 disabled:cursor-not-allowed disabled:text-warm-400 disabled:hover:bg-transparent";
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="inline-flex items-center rounded-lg border border-warm-200 bg-white">
      <span id={`${id}-label`} className="sr-only">
        {t("quantity")}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={t("decrease")}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <output aria-live="polite" className="w-8 text-center font-bold tabular-nums text-ink">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={t("increase")}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
