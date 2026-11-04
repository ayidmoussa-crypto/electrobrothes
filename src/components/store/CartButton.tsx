"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cartCount, useCart } from "@/lib/cart-store";
import { CartDrawer, openCartDrawer } from "./CartDrawer";

export function CartButton() {
  const t = useTranslations("header");
  const count = cartCount(useCart());

  return (
    <>
      {/* A real link to /cart (works without JS, ctrl/cmd-click opens the page); a plain click opens the side cart. */}
      <Link
        href="/cart"
        aria-haspopup="dialog"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          openCartDrawer();
        }}
        // Phones: a yellow round button, smaller than the logo beside it; ::before keeps the 44px tap area.
        className="relative inline-flex size-11 items-center justify-center rounded-full transition-colors hover:text-yellow-500 max-md:size-9 max-md:bg-yellow-500 max-md:text-ink max-md:before:absolute max-md:before:-inset-1 max-md:hover:bg-yellow-600 max-md:hover:text-ink max-md:active:bg-yellow-700"
      >
        <ShoppingBag className="size-6 max-md:size-5" aria-hidden="true" />
        <span className="sr-only">{t("cart")}</span>
        {/* Announced politely when an item is added anywhere on the page. */}
        <span aria-live="polite" className="sr-only">
          {t("cartCount", { count })}
        </span>
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-yellow-500 px-1 text-xs font-bold text-ink max-md:bg-white max-md:ring-2 max-md:ring-ink"
          >
            {count}
          </span>
        ) : null}
      </Link>
      <CartDrawer />
    </>
  );
}
