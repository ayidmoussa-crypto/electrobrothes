import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CartView } from "@/components/store/CartView";
import type { Locale } from "@/i18n/routing";
import { getCheckoutConfig } from "@/lib/store-config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, config] = await Promise.all([getTranslations("cart"), getCheckoutConfig()]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ label: t("title") }]} />
      <h1 className="mb-6 text-3xl md:text-4xl">{t("title")}</h1>
      <CartView locale={locale} config={config} />
    </div>
  );
}
