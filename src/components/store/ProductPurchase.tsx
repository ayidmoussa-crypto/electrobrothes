"use client";

import { CircleCheck, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cart, MAX_QTY } from "@/lib/cart-store";
import { formatMAD } from "@/lib/money";
import type { CheckoutConfig } from "@/lib/store-config";
import { openCartDrawer } from "./CartDrawer";
import { QtyStepper } from "./QtyStepper";
import { TopUpProducts } from "./TopUpProducts";
import { useCartLines } from "./useCartLines";
import { VariantPicker, type PickerVariant } from "./VariantPicker";

/**
 * Everything the shopper does on a product page: choose a variant and quantity, add to cart,
 * add other products towards free delivery, or go on to the order page.
 */
export function ProductPurchase({
  variants,
  name,
  slug,
  locale,
  config,
  children,
}: {
  variants: PickerVariant[];
  name: string;
  slug: string;
  locale: Locale;
  config: CheckoutConfig;
  children?: React.ReactNode;
}) {
  const t = useTranslations("pdp");
  const tc = useTranslations("cart");
  const tp = useTranslations("product");
  const [selected, setSelected] = useState(() => variants.find((v) => v.stock > 0) ?? variants[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // ViewContent once per product page view (for the variant shown first).
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track({ name: "ViewContent", items: [{ id: selected.id, name, price: selected.price, quantity: 1 }] });
  }, [selected, name]);

  const soldOut = selected.stock <= 0;
  // Tells the floating WhatsApp button to sit above the order bar. An effect, not a CSS :has() on the bar: Next keeps a
  // left page in the DOM, hidden, and an effect is the part that does stop when the shopper leaves.
  useEffect(() => {
    if (soldOut) return;
    document.documentElement.dataset.orderBar = "";
    return () => {
      delete document.documentElement.dataset.orderBar;
    };
  }, [soldOut]);

  const maxQty = Math.max(1, Math.min(MAX_QTY, selected.stock));
  const quantity = Math.min(qty, maxQty);
  // What the order would come to: this choice, plus whatever else is already in the cart.
  const { rows } = useCartLines();
  const others = rows.reduce((sum, r) => (r.line && r.item.variantId !== selected.id ? sum + r.line.price * Math.min(r.item.qty, r.line.stock) : sum), 0);
  const spent = selected.price * quantity + others;

  // The order form has its own page and works on the cart, so "order now" puts this choice there first.
  const orderNow = () => {
    cart.put(selected.id, quantity);
    track({ name: "AddToCart", items: [{ id: selected.id, name, price: selected.price, quantity }] });
  };

  return (
    <>
      <VariantPicker
        variants={variants}
        selected={selected}
        onSelect={(v) => {
          setSelected(v);
          setAdded(false);
        }}
        locale={locale}
      />

      {soldOut ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <QtyStepper id="pdp-qty" value={quantity} max={maxQty} onChange={setQty} />
          <button
            type="button"
            onClick={() => {
              cart.add(selected.id, quantity);
              setAdded(true);
              openCartDrawer();
              track({ name: "AddToCart", items: [{ id: selected.id, name, price: selected.price, quantity }] });
            }}
            className={buttonClass({ variant: "outline", className: "flex-1" })}
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            {tc("addToCart")}
          </button>
        </div>
      )}

      <div aria-live="polite">
        {added ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-semibold text-success">
            <CircleCheck className="size-4" aria-hidden="true" />
            {tc("added")}
            <Link href="/cart" className="ms-auto text-ink underline underline-offset-4">
              {tc("viewCart")}
            </Link>
          </p>
        ) : null}
      </div>

      <Link
        href="/checkout"
        onClick={orderNow}
        aria-disabled={soldOut}
        className={buttonClass({ size: "lg", className: `w-full ${soldOut ? "pointer-events-none bg-warm-100 text-warm-400" : ""}` })}
      >
        {soldOut ? tp("outOfStock") : t("orderNow")}
      </Link>

      {soldOut ? null : <TopUpProducts spent={spent} threshold={config.freeShippingThreshold} excludeSlug={slug} locale={locale} />}

      {children}

      {/* Mobile: price + CTA always reachable, on light glass; padded for the iOS home indicator. */}
      {!soldOut ? (
        <div className="glass-light fixed inset-x-2 bottom-2 z-30 flex items-center gap-3 rounded-glass border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <p className="min-w-0 flex-1 text-lg font-extrabold text-ink">{formatMAD(selected.price * quantity, locale)}</p>
          <Link href="/checkout" onClick={orderNow} className={buttonClass({ className: "flex-1" })}>
            {t("orderNow")}
          </Link>
        </div>
      ) : null}
    </>
  );
}
