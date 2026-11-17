"use client";

import { CircleCheck, Info, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { track } from "@/lib/analytics";
import { cart, useCart } from "@/lib/cart-store";
import { formatMAD } from "@/lib/money";
import { openCartDrawer } from "./CartDrawer";
import { useOrderBar } from "./useOrderBar";

export type BundlePurchaseItem = {
  productId: string;
  name: string;
  quantity: number;
  variants: { id: string; colorAr: string | null; colorEn: string | null; colorHex: string | null; storage: string | null; price: number; stock: number }[];
};

/**
 * The pack's buy box. Its products go into the cart as ordinary lines (the colour chosen here for each);
 * the cart and the order then take the pack saving off by themselves.
 */
export function BundlePurchase({ items, name, price, available, locale }: { items: BundlePurchaseItem[]; name: string; price: number; available: boolean; locale: Locale }) {
  const t = useTranslations("bundles");
  const tc = useTranslations("cart");
  const ar = locale === "ar";
  const inCart = useCart();
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.productId, (i.variants.find((v) => v.stock >= i.quantity) ?? i.variants[0]).id])),
  );
  const [added, setAdded] = useState(false);

  const chosen = items.map((i) => ({ item: i, variant: i.variants.find((v) => v.id === choice[i.productId])! }));
  const canBuy = available && chosen.every((c) => c.variant.stock >= c.item.quantity);

  const { buttonRef, visible: barVisible } = useOrderBar<HTMLAnchorElement>(canBuy);

  const trackAdd = () =>
    track({ name: "AddToCart", items: chosen.map((c) => ({ id: c.variant.id, name: c.item.name, price: c.variant.price, quantity: c.item.quantity })) });

  const addToCart = () => {
    for (const c of chosen) cart.add(c.variant.id, c.item.quantity);
    setAdded(true);
    openCartDrawer();
    trackAdd();
  };

  // "Order now" pressed twice must not put two packs in the cart: each line is raised to what one pack needs.
  const orderNow = () => {
    for (const c of chosen) {
      const have = inCart.find((x) => x.variantId === c.variant.id)?.qty ?? 0;
      cart.put(c.variant.id, Math.max(have, c.item.quantity));
    }
    trackAdd();
  };

  const label = (v: BundlePurchaseItem["variants"][number]) => [ar ? v.colorAr : v.colorEn, v.storage].filter(Boolean).join(" · ");

  return (
    <>
      {items.map((i) => {
        const options = i.variants.filter((v) => v.stock > 0);
        if (options.length < 2) return null;
        return (
          <fieldset key={i.productId} className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-ink">
              {t("chooseColor", { name: i.name })}: <span className="font-normal text-warm-600">{label(chosen.find((c) => c.item.productId === i.productId)!.variant)}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {options.map((v) => {
                const enough = v.stock >= i.quantity;
                return (
                  <label
                    key={v.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-3 text-sm transition-colors has-[:checked]:border-ink has-[:checked]:bg-yellow-100 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-yellow-300 ${
                      enough ? "border-warm-200 bg-white hover:border-warm-400" : "cursor-not-allowed border-warm-200 bg-warm-50 text-warm-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`color-${i.productId}`}
                      value={v.id}
                      checked={choice[i.productId] === v.id}
                      disabled={!enough}
                      onChange={() => {
                        setChoice((c) => ({ ...c, [i.productId]: v.id }));
                        setAdded(false);
                      }}
                      className="sr-only"
                    />
                    {v.colorHex ? <span aria-hidden="true" className="size-5 rounded-full border border-warm-300" style={{ backgroundColor: v.colorHex }} /> : null}
                    {label(v) || "—"}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {canBuy ? (
        <>
          <button type="button" onClick={addToCart} className={buttonClass({ variant: "outline", className: "w-full" })}>
            <ShoppingBag className="size-5" aria-hidden="true" />
            {t("addToCart")}
          </button>
          <div aria-live="polite" className="empty:hidden">
            {added ? (
              <p className="flex flex-wrap items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-semibold text-success">
                <CircleCheck className="size-4" aria-hidden="true" />
                {t("added")}
                <Link href="/cart" className="ms-auto text-ink underline underline-offset-4">
                  {tc("viewCart")}
                </Link>
              </p>
            ) : null}
          </div>
          <Link ref={buttonRef} href="/checkout" onClick={orderNow} className={buttonClass({ size: "lg", className: "w-full" })}>
            {t("orderNow")}
          </Link>
          <p className="flex gap-2 text-sm text-warm-600">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("howItWorks")}
          </p>

          {/* Phones: price + order, only while the main button is off screen; padded for the iOS home indicator. */}
          {barVisible ? (
            <div className="glass-light fixed inset-x-2 bottom-2 z-30 flex items-center gap-3 rounded-glass border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
              <p className="min-w-0 flex-1 text-lg font-extrabold text-ink">{formatMAD(price, locale)}</p>
              <Link href="/checkout" onClick={orderNow} className={buttonClass({ className: "flex-1" })} aria-label={`${t("orderNow")}: ${name}`}>
                {t("orderNow")}
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{t("soldOut")}</p>
      )}
    </>
  );
}
