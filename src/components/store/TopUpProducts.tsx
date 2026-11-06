"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { getTopUpProducts, type TopUpProduct } from "@/app/actions/cart";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { track } from "@/lib/analytics";
import { cart, useCart } from "@/lib/cart-store";
import { formatMAD } from "@/lib/money";
import { rankTopUp } from "@/lib/top-up";
import { FreeDeliveryRail } from "./FreeDeliveryRail";

const SHOWN = 6;

/**
 * Button that opens a short list of products to add towards free delivery. The list is read when it is first
 * opened and keeps its order afterwards, so a row does not jump away from under the finger after adding it.
 */
export function TopUpProducts({ spent, threshold, excludeSlug, locale }: { spent: number; threshold: number; excludeSlug?: string; locale: Locale }) {
  const t = useTranslations("checkout");
  const panel = useId();
  const items = useCart();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<TopUpProduct[] | null>(null);
  const missing = threshold - spent;

  // Once the goal is reached there is nothing to offer, unless the list is open: it then shows the good news.
  if (threshold <= 0 || (missing <= 0 && !open)) return null;

  const toggle = () => {
    setOpen(!open);
    if (list) return;
    getTopUpProducts()
      .then((all) => setList(rankTopUp(all.filter((p) => p.slug !== excludeSlug), missing, SHOWN)))
      .catch(() => setList([]));
  };

  return (
    <div className="rounded-xl border border-warm-200 bg-warm-50">
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={panel} className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-start">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-yellow-500 text-ink">
          <Plus className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">{t("topUpButton", { goal: formatMAD(threshold, locale) })}</span>
          {/* Once open, the rail below says the same thing. */}
          {missing > 0 && !open ? <span className="block text-sm text-warm-600">{t("topUpMissing", { amount: formatMAD(missing, locale) })}</span> : null}
        </span>
        <ChevronDown className={`size-5 shrink-0 text-warm-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <div id={panel} hidden={!open} className="px-3 pb-3">
        <FreeDeliveryRail spent={spent} threshold={threshold} locale={locale} />
        {!list ? (
          <div className="mt-3 flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {list.map((p) => {
              const name = locale === "ar" ? p.nameAr : p.nameEn;
              const inCart = items.some((i) => i.variantId === p.variantId);
              return (
                <li key={p.slug} className="flex items-center gap-3 rounded-lg border border-warm-200 bg-white p-2">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-warm-50">
                    {p.image ? <Image src={p.image} alt="" fill sizes="64px" unoptimized={p.image.endsWith(".svg")} className="object-contain p-1" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${p.slug}`} className="line-clamp-2 text-sm font-semibold text-ink underline-offset-4 hover:underline">
                      {name}
                    </Link>
                    <p className="mt-0.5 font-extrabold text-ink">{formatMAD(p.price, locale)}</p>
                  </div>
                  {inCart ? (
                    <span className="flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-success">
                      <Check className="size-4" aria-hidden="true" />
                      {t("topUpAdded")}
                    </span>
                  ) : p.hasOptions ? (
                    <Link href={`/products/${p.slug}`} aria-label={t("topUpChooseFor", { name })} className={buttonClass({ variant: "outline", className: "shrink-0 px-3 text-sm" })}>
                      {t("topUpChoose")}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        cart.add(p.variantId);
                        track({ name: "AddToCart", items: [{ id: p.variantId, name, price: p.price, quantity: 1 }] });
                      }}
                      aria-label={t("topUpAddFor", { name })}
                      className={buttonClass({ variant: "outline", className: "shrink-0 px-3 text-sm" })}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {t("topUpAdd")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
