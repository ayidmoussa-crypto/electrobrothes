import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { drawDate, GiveawayCard } from "@/components/store/GiveawayCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getGiveawayBySlug } from "@/lib/giveaways";
import { pageMetadata } from "@/lib/seo";

// A giveaway lives for days and its entry count changes every minute: the page waits for its data.
export const instant = false;

const RULES =["free", "who", "once", "when", "fair", "contact", "backup", "delivery", "platforms", "data"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/giveaway/[slug]">): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const g = await getGiveawayBySlug(slug);
  if (!g) return {};
  const t = await getTranslations({ locale, namespace: "giveaway" });
  const ar = locale === "ar";
  return {
    ...pageMetadata({ locale, path: `/giveaway/${slug}`, title: t("pageTitle", { prize: ar ? g.prizeAr : g.prizeEn }), description: ar ? g.titleAr : g.titleEn }),
    // A giveaway ends within days: kept out of search results.
    robots: { index: false, follow: true },
  };
}

async function Giveaway({ locale, slug }: { locale: Locale; slug: string }) {
  const [t, g] = await Promise.all([getTranslations("giveaway"), getGiveawayBySlug(slug)]);
  if (!g) notFound();
  const ar = locale === "ar";
  const details = ar ? g.detailsAr : g.detailsEn;

  return (
    <>
      <Breadcrumbs locale={locale} items={[{ label: ar ? g.titleAr : g.titleEn }]} />
      <GiveawayCard g={g} locale={locale} />

      <section id="rules" className="mt-12 scroll-mt-28 grid gap-8 md:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="text-2xl md:text-3xl">{t("rulesTitle")}</h2>
          {details ? <p className="mt-3 whitespace-pre-line text-warm-800">{details}</p> : null}
        </div>
        <ul className="flex flex-col gap-3">
          {RULES.map((key) => (
            <li key={key} className="flex items-start gap-3 rounded-xl border border-warm-200 bg-white p-4 text-warm-800">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              <span>
                {t(`rules.${key}`, { date: drawDate(g.drawAt, locale) })}
                {key === "data" ? (
                  <>
                    {" "}
                    <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">
                      {t("privacyLink")}
                    </Link>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default async function GiveawayPage({ params }: PageProps<"/[locale]/giveaway/[slug]">) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Suspense fallback={<Skeleton className="mt-8 h-[36rem] rounded-[2rem]" />}>
        <Giveaway locale={locale} slug={slug} />
      </Suspense>
    </div>
  );
}
