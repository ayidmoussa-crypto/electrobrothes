"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatePanel } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { CheckoutConfig } from "@/lib/store-config";
import { TrackOnce } from "@/components/analytics/TrackOnce";
import { OrderForm } from "./OrderForm";
import { TopUpProducts } from "./TopUpProducts";
import { packSaving, useCartLines } from "./useCartLines";
import { VisitEvent } from "@/components/analytics/VisitTracker";

export function CheckoutView({ locale, config }: { locale: Locale; config: CheckoutConfig }) {
  const t = useTranslations("cart");
  const tc = useTranslations("checkout");
  const { ready, loading, rows, bundles } = useCartLines();
  const ar = locale === "ar";

  if (!ready) return <Skeleton className="h-[40rem] w-full max-w-xl" />;

  const lines = rows
    .filter((r) => r.line && r.line.stock > 0)
    .map(({ item, line }) => ({
      variantId: item.variantId,
      productId: line!.productId,
      name: ar ? line!.nameAr : line!.nameEn,
      label: ar ? line!.labelAr : line!.labelEn,
      price: line!.price,
      qty: Math.min(item.qty, line!.stock),
      image: line!.image,
    }));

  // Only while nothing is known yet: adding a product here must not remove the form the shopper is filling in.
  if (loading && !lines.length) return <Skeleton className="h-[40rem] w-full max-w-xl" />;

  if (!lines.length) {
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

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      {/* A checkout with something in it: the step between the cart and the order (visitors page). */}
      <VisitEvent event={{ type: "checkout_start" }} />
      <TrackOnce event={{ name: "InitiateCheckout", items: lines.map((l) => ({ id: l.variantId, name: l.name, price: l.price, quantity: l.qty })) }} />
      <TopUpProducts spent={lines.reduce((sum, l) => sum + l.price * l.qty, 0) - packSaving(lines, bundles, ar).discount} threshold={config.freeShippingThreshold} locale={locale} />
      <OrderForm source="cart" title={tc("formTitle")} lines={lines} bundles={bundles} config={config} locale={locale} />
    </div>
  );
}
