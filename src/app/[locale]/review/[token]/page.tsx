import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ReviewForm } from "@/components/store/ReviewForm";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Locale } from "@/i18n/routing";
import { reviewPageData } from "@/lib/reviews/customer";

// A private link, one per order: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Every token is different and none can be prerendered, so the page simply waits for its data.
export const instant = false;

async function Body({ params }: { params: PageProps<"/[locale]/review/[token]">["params"] }) {
  const { locale: l, token } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, data] = await Promise.all([getTranslations({ locale, namespace: "reviewForm" }), reviewPageData(token)]);
  const ar = locale === "ar";

  return (
    <>
      <h1 className="text-2xl md:text-3xl">{t("title")}</h1>
      {!data || !data.items.length ? (
        <p className="mt-4 rounded-xl border border-warm-200 bg-warm-50 p-4 text-warm-800">{t("closed")}</p>
      ) : (
        <>
          <p className="mt-2 text-warm-600">{t("intro")}</p>
          <div className="mt-6 flex flex-col gap-4">
            {data.items.map((item) =>
              item.reviewed ? (
                <p key={item.id} className="flex items-center gap-2 rounded-xl border border-warm-200 bg-white p-4 text-sm font-semibold text-success">
                  <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                  {t("done", { name: ar ? item.nameAr : item.nameEn })}
                </p>
              ) : (
                <ReviewForm key={item.id} token={token} locale={locale} photos={data.photos} item={{ id: item.id, name: ar ? item.nameAr : item.nameEn, variant: ar ? item.variant : null, image: item.image }} />
              ),
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function ReviewPage({ params }: PageProps<"/[locale]/review/[token]">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}
