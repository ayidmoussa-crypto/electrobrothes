import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CheckoutView } from "@/components/store/CheckoutView";
import type { Locale } from "@/i18n/routing";
import { getCheckoutConfig } from "@/lib/store-config";

export async function generateMetadata({ params }: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/[locale]/checkout">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tc, config] = await Promise.all([getTranslations("checkout"), getTranslations("cart"), getCheckoutConfig()]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ href: "/cart", label: tc("title") }, { label: t("title") }]} />
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="mt-2 mb-6 text-warm-600">{t("subtitle")}</p>
      <CheckoutView locale={locale} config={config} />
    </div>
  );
}
