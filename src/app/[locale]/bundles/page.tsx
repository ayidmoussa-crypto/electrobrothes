import { Package } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { BundleCard } from "@/components/store/BundleCard";
import { buttonClass } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getBundles } from "@/lib/bundles-data";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/bundles">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "bundles" });
  return pageMetadata({ locale, path: "/bundles", title: t("title"), description: t("metaDescription") });
}

export default async function BundlesPage({ params }: PageProps<"/[locale]/bundles">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tc, bundles] = await Promise.all([getTranslations("bundles"), getTranslations("cart"), getBundles()]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ label: t("title") }]} />
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="mt-2 mb-6 text-warm-600">{t("subtitle")}</p>
      {bundles.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b, i) => (
            <li key={b.id}>
              <BundleCard bundle={b} locale={locale} priority={i < 3} />
            </li>
          ))}
        </ul>
      ) : (
        <StatePanel
          icon={Package}
          title={t("empty")}
          action={
            <Link href="/" className={buttonClass()}>
              {tc("continue")}
            </Link>
          }
        />
      )}
    </div>
  );
}
