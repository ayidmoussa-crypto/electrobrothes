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
import { useCartLines } from "./useCartLines";

export function CheckoutView({ locale, config }: { locale: Locale; config: CheckoutConfig }) {
  const t = useTranslations("cart");
  const tc = useTranslations("checkout");
  const { ready, loading, rows } = useCartLines();
  const ar = locale === "ar";

  if (!ready || loading) return <Skeleton className="h-[40rem] w-full max-w-xl" />;

  const lines = rows
    .filter((r) => r.line && r.line.stock > 0)
    .map(({ item, line }) => ({
      variantId: item.variantId,
      name: ar ? line!.nameAr : line!.nameEn,
      label: ar ? line!.labelAr : line!.labelEn,
      price: line!.price,
      qty: Math.min(item.qty, line!.stock),
    }));

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
    <div className="max-w-xl">
      <TrackOnce event={{ name: "InitiateCheckout", items: lines.map((l) => ({ id: l.variantId, name: l.name, price: l.price, quantity: l.qty })) }} />
      <OrderForm source="cart" title={tc("formTitle")} lines={lines} config={config} locale={locale} />
    </div>
  );
}
