"use client";

import { Plus, ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatePanel } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { track } from "@/lib/analytics";
import { cart, MAX_QTY } from "@/lib/cart-store";
import { formatMAD } from "@/lib/money";
import { FreeDeliveryRail } from "./FreeDeliveryRail";
import { computeTotals } from "@/lib/pricing";
import type { CheckoutConfig } from "@/lib/store-config";
import { QtyStepper } from "./QtyStepper";
import { packSaving, useCartLines } from "./useCartLines";

export function CartView({ locale, config }: { locale: Locale; config: CheckoutConfig }) {
  const t = useTranslations("cart");
  const tc = useTranslations("checkout");
  const { ready, loading, rows, upsell, bundles } = useCartLines();
  const [cityId, setCityId] = useState("");
  const ar = locale === "ar";

  if (!ready) {
    return (
      <div role="status" aria-busy="true" className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <span className="sr-only">{t("loading")}</span>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <StatePanel
        icon={ShoppingBag}
        title={t("empty")}
        description={t("emptyText")}
        action={
          <Link href="/" className={buttonClass()}>
            {t("continue")}
          </Link>
        }
      />
    );
  }

  const available = rows.filter((r) => r.line && r.line.stock > 0);
  const city = config.cities.find((c) => c.id === cityId);
  const priced = available.map((r) => ({ productId: r.line!.productId, price: r.line!.price, qty: Math.min(r.item.qty, r.line!.stock) }));
  const pack = packSaving(priced, bundles, ar);
  const totals = computeTotals({
    items: priced.map((l) => ({ unitPrice: l.price, quantity: l.qty })),
    shippingFee: city?.shippingFee ?? 0,
    freeShippingThreshold: config.freeShippingThreshold,
    bundleDiscount: pack.discount,
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-8">
        <ul className="flex flex-col divide-y divide-warm-200 rounded-xl border border-warm-200">
          {rows.map(({ item, line }) => {
            if (!line && loading) {
              return (
                <li key={item.variantId} className="p-3 sm:p-4" aria-hidden="true">
                  <Skeleton className="h-20" />
                </li>
              );
            }
            const name = line ? (ar ? line.nameAr : line.nameEn) : t("unavailable");
            const soldOut = !line || line.stock <= 0;
            const capped = line && item.qty > line.stock && line.stock > 0;
            return (
              <li key={item.variantId} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-warm-50 sm:size-24">
                  {line?.image ? (
                    <Image src={line.image} alt="" fill sizes="96px" unoptimized={line.image.endsWith(".svg")} className="object-contain p-2" />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {line ? (
                        <Link href={`/products/${line.slug}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                          {name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-warm-600">{name}</p>
                      )}
                      {line && (ar ? line.labelAr : line.labelEn) ? (
                        <p className="text-sm text-warm-600">{ar ? line.labelAr : line.labelEn}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => cart.remove(item.variantId)}
                      aria-label={t("remove", { name })}
                      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-warm-600 hover:bg-warm-100 hover:text-danger"
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                  {soldOut ? (
                    <p className="flex items-center gap-1 text-sm font-semibold text-danger">
                      <TriangleAlert className="size-4" aria-hidden="true" />
                      {line ? tc("errors.out_of_stock", { products: name }) : t("unavailable")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <QtyStepper
                        id={`qty-${item.variantId}`}
                        value={Math.min(item.qty, line!.stock)}
                        max={Math.min(MAX_QTY, line!.stock)}
                        onChange={(n) => cart.setQty(item.variantId, n)}
                      />
                      <p className="font-extrabold text-ink">{formatMAD(line!.price * Math.min(item.qty, line!.stock), locale)}</p>
                      {capped ? <p className="w-full text-sm text-warning-text">{t("onlyLeft", { count: line!.stock })}</p> : null}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {upsell.length ? (
          <section>
            <h2 className="mb-3 text-lg">{t("upsell")}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {upsell.map((u) => (
                <li key={u.variantId} className="flex flex-col gap-2 rounded-xl border border-warm-200 p-3">
                  <div className="relative aspect-square rounded-lg bg-warm-50">
                    {u.image ? <Image src={u.image} alt="" fill sizes="25vw" unoptimized={u.image.endsWith(".svg")} className="object-contain p-2" /> : null}
                  </div>
                  <Link href={`/products/${u.slug}`} className="line-clamp-2 text-sm font-semibold text-ink">
                    {ar ? u.nameAr : u.nameEn}
                  </Link>
                  <p className="mt-auto font-bold text-ink">{formatMAD(u.price, locale)}</p>
                  <button
                    type="button"
                    onClick={() => {
                      cart.add(u.variantId);
                      track({ name: "AddToCart", items: [{ id: u.variantId, name: u.nameEn, price: u.price, quantity: 1 }] });
                    }}
                    className={buttonClass({ variant: "outline", className: "w-full" })}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {t("add")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="h-fit rounded-xl border border-warm-200 bg-warm-50 p-4 lg:sticky lg:top-4">
        <h2 className="text-lg">{t("summary")}</h2>
        <div className="mt-3">
          <label htmlFor="cart-city" className="text-sm font-semibold text-ink">
            {t("shippingEstimate")}
          </label>
          <Select id="cart-city" value={cityId} onChange={(e) => setCityId(e.target.value)} className="mt-1 bg-white">
            <option value="">{tc("chooseCity")}</option>
            {config.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {ar ? c.nameAr : c.nameEn} — {formatMAD(c.shippingFee, locale)}
              </option>
            ))}
          </Select>
        </div>
        <dl className="mt-4 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-warm-600">{tc("subtotal")}</dt>
            <dd className="font-semibold text-ink">{formatMAD(totals.subtotal, locale)}</dd>
          </div>
          {pack.discount ? (
            <div className="flex justify-between gap-3">
              <dt className="text-warm-600">
                {tc("packDiscount")}
                <span className="block text-xs">{pack.names.join("، ")}</span>
              </dt>
              <dd className="shrink-0 font-semibold text-success">−{formatMAD(pack.discount, locale)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-warm-600">{tc("shipping")}</dt>
            <dd className="font-semibold text-ink">
              {!city ? tc("chooseCityForShipping") : totals.shipping === 0 ? tc("free") : formatMAD(totals.shipping, locale)}
            </dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-warm-200 pt-2 text-base">
            <dt className="font-bold text-ink">{tc("total")}</dt>
            <dd className="text-xl font-extrabold text-ink">{formatMAD(totals.total, locale)}</dd>
          </div>
        </dl>
        <FreeDeliveryRail spent={totals.subtotal - totals.discount} threshold={config.freeShippingThreshold} locale={locale} />
        <Link
          href="/checkout"
          aria-disabled={!available.length}
          className={buttonClass({ size: "lg", className: `mt-4 w-full ${available.length ? "" : "pointer-events-none bg-warm-100 text-warm-400"}` })}
        >
          {t("checkout")}
        </Link>
        <p className="mt-3 text-center text-xs text-warm-600">{tc("codBanner")}</p>
      </aside>
    </div>
  );
}
