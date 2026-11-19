import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { SupportFindForm } from "@/components/store/SupportFindForm";
import type { Locale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { ORDER_COOKIE } from "@/lib/orders";
import { formatMoroccanPhone } from "@/lib/phone";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/support">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "support" });
  return pageMetadata({ locale, path: "/support", title: t("title"), description: t("subtitle") });
}

/** Filled with the buyer's last order when this browser placed one, like the tracking page. */
async function FormForBuyer() {
  const orderId = (await cookies()).get(ORDER_COOKIE)?.value;
  const last = orderId ? await db.order.findUnique({ where: { id: orderId }, select: { number: true, phone: true } }) : null;
  return <SupportFindForm initial={last ? { number: last.number, phone: formatMoroccanPhone(last.phone) } : undefined} />;
}

export default async function SupportPage({ params }: PageProps<"/[locale]/support">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("support");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ label: t("title") }]} />
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-warm-600">{t("subtitle")}</p>
      <Suspense fallback={<SupportFindForm />}>
        <FormForBuyer />
      </Suspense>
    </div>
  );
}
