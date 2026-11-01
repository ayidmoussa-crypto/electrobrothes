"use client";

import { ShoppingBag, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cart, MAX_QTY } from "@/lib/cart-store";
import { formatMAD } from "@/lib/money";
import { QtyStepper } from "./QtyStepper";
import { useCartLines } from "./useCartLines";

const OPEN_EVENT = "eb:open-cart";

/** Opens the side cart from anywhere (header button, "add to cart"). */
export function openCartDrawer() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Side cart on light glass. A native modal <dialog>: focus is trapped, Esc closes it,
 * the page behind is inert. Lines are only fetched while it is open.
 */
export function CartDrawer() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const show = () => {
      ref.current?.showModal();
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  // Navigating from inside the drawer closes it.
  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  return (
    <dialog
      ref={ref}
      onClose={() => setOpen(false)}
      // A click on the dimmed area (the dialog element itself, outside the panel) closes it.
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="drawer drawer-end glass-light fixed inset-y-0 end-0 start-auto m-0 h-dvh max-h-dvh w-[min(26rem,100vw)] max-w-none rounded-s-glass border text-ink backdrop:bg-ink/40"
    >
      {open ? <DrawerBody onClose={() => ref.current?.close()} /> : null}
    </dialog>
  );
}

function DrawerBody({ onClose }: { onClose: () => void }) {
  const t = useTranslations("cart");
  const tc = useTranslations("checkout");
  const locale = useLocale() as Locale;
  const ar = locale === "ar";
  const { ready, loading, rows } = useCartLines();

  const available = rows.filter((r) => r.line && r.line.stock > 0);
  const subtotal = available.reduce((sum, r) => sum + r.line!.price * Math.min(r.item.qty, r.line!.stock), 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <h2 className="text-lg">{t("title")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid size-11 cursor-pointer place-items-center rounded-lg text-ink hover:bg-ink/5"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {!ready ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-3 p-4">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !rows.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <ShoppingBag className="size-10 text-warm-600" aria-hidden="true" />
          <p className="font-bold">{t("empty")}</p>
          <p className="text-sm text-warm-600">{t("emptyText")}</p>
          <button type="button" onClick={onClose} className={buttonClass({ className: "mt-2" })}>
            {t("continue")}
          </button>
        </div>
      ) : (
        <>
          <ul className="flex-1 divide-y divide-ink/10 overflow-y-auto px-4">
            {rows.map(({ item, line }) => {
              if (!line && loading) {
                return (
                  <li key={item.variantId} className="py-3" aria-hidden="true">
                    <Skeleton className="h-16" />
                  </li>
                );
              }
              const name = line ? (ar ? line.nameAr : line.nameEn) : t("unavailable");
              const soldOut = !line || line.stock <= 0;
              return (
                <li key={item.variantId} className="flex gap-3 py-3">
                  {/* Solid white tile: product photos never sit directly on the glass. */}
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-white">
                    {line?.image ? (
                      <Image src={line.image} alt="" fill sizes="64px" unoptimized={line.image.endsWith(".svg")} className="object-contain p-1.5" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold">{name}</p>
                        {line && (ar ? line.labelAr : line.labelEn) ? (
                          <p className="text-xs text-warm-600">{ar ? line.labelAr : line.labelEn}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => cart.remove(item.variantId)}
                        aria-label={t("remove", { name })}
                        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-warm-600 hover:bg-ink/5 hover:text-danger"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    {soldOut ? (
                      <p className="text-sm font-semibold text-danger">{t("unavailable")}</p>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <QtyStepper
                          id={`drawer-qty-${item.variantId}`}
                          value={Math.min(item.qty, line!.stock)}
                          max={Math.min(MAX_QTY, line!.stock)}
                          onChange={(n) => cart.setQty(item.variantId, n)}
                        />
                        <p className="font-extrabold">{formatMAD(line!.price * Math.min(item.qty, line!.stock), locale)}</p>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2 border-t border-ink/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex justify-between text-base">
              <span className="font-bold">{tc("subtotal")}</span>
              <span className="text-lg font-extrabold">{formatMAD(subtotal, locale)}</span>
            </div>
            <p className="text-xs text-warm-600">{tc("codBanner")}</p>
            <Link
              href="/checkout"
              aria-disabled={!available.length}
              className={buttonClass({ size: "lg", className: `w-full ${available.length ? "" : "pointer-events-none bg-warm-100 text-warm-400"}` })}
            >
              {t("checkout")}
            </Link>
            <Link href="/cart" className={buttonClass({ variant: "outline", className: "w-full" })}>
              {t("viewCart")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
