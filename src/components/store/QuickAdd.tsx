"use client";

import { ShoppingCart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cart } from "@/lib/cart-store";
import { openCartDrawer } from "./CartDrawer";

// Ink at rest so a grid of cards stays mostly black and white; it turns yellow, the action colour, when used.
const shape =
  "relative z-10 flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition-colors duration-150 sm:text-base";
const live = `${shape} cursor-pointer bg-ink text-white hover:bg-yellow-500 hover:text-ink active:bg-yellow-700 active:text-ink`;

/**
 * The card's button. One variant: into the cart, then the drawer opens. Several (colours, sizes): to the product
 * page to choose. Sold out: a disabled button. It sits above the card's stretched link (z-10).
 */
export function QuickAdd({
  variantId,
  href,
  name,
  price,
  soldOut,
  labels,
}: {
  variantId: string | null;
  href: string;
  name: string;
  price: number;
  soldOut: boolean;
  labels: { add: string; choose: string; soldOut: string };
}) {
  if (soldOut) {
    return (
      <button type="button" disabled className={`${shape} cursor-not-allowed bg-warm-100 text-warm-600`}>
        {labels.soldOut}
      </button>
    );
  }
  if (!variantId) {
    return (
      <Link href={href} className={live}>
        {labels.choose}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        cart.add(variantId);
        openCartDrawer();
        track({ name: "AddToCart", items: [{ id: variantId, name, price, quantity: 1 }] });
      }}
      className={live}
    >
      <ShoppingCart className="size-4.5" aria-hidden="true" />
      {labels.add}
    </button>
  );
}
