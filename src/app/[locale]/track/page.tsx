import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { TrackForm } from "@/components/store/TrackForm";
import type { Locale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { ORDER_COOKIE } from "@/lib/orders";
import { formatMoroccanPhone } from "@/lib/phone";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/track">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "track" });
  return pageMetadata({ locale, path: "/track", title: t("title"), description: t("subtitle") });
}

/** The form, filled with the buyer's last order when this browser placed one (the httpOnly cookie set on ordering). */
async function TrackFormForBuyer() {
  const orderId = (await cookies()).get(ORDER_COOKIE)?.value;
  const last = orderId ? await db.order.findUnique({ where: { id: orderId }, select: { number: true, phone: true } }) : null;
  return <TrackForm initial={last ? { number: last.number, phone: formatMoroccanPhone(last.phone) } : undefined} />;
}

export default async function TrackPage({ params }: PageProps<"/[locale]/track">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("track");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ label: t("title") }]} />
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="mt-2 mb-6 text-warm-600">{t("subtitle")}</p>
      <Suspense fallback={<TrackForm />}>
        <TrackFormForBuyer />
      </Suspense>
    </div>
  );
}
