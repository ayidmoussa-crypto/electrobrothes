import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { TrackForm } from "@/components/store/TrackForm";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/track">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "track" });
  return pageMetadata({ locale, path: "/track", title: t("title"), description: t("subtitle") });
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
      <TrackForm />
    </div>
  );
}
