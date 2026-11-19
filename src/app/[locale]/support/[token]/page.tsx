import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { SupportChat } from "@/components/store/SupportChat";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { supportPageData } from "@/lib/support/customer";

// A private link, one per order: never indexed.
export async function generateMetadata({ params }: PageProps<"/[locale]/support/[token]">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "support" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

// Every token is different and none can be prerendered.
export const instant = false;

async function Body({ params }: { params: PageProps<"/[locale]/support/[token]">["params"] }) {
  const { locale: l, token } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, data] = await Promise.all([getTranslations({ locale, namespace: "support" }), supportPageData(token, locale === "ar")]);

  return (
    <>
      <h1 className="text-2xl md:text-3xl">{t("title")}</h1>
      {!data ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="rounded-xl border border-warm-200 bg-warm-50 p-4 text-warm-800">{t("errors.closed")}</p>
          <Link href="/support" className="text-sm font-semibold text-ink underline underline-offset-4">
            {t("submit")}
          </Link>
        </div>
      ) : (
        <SupportChat token={token} data={data} />
      )}
    </>
  );
}

export default function SupportChatPage({ params }: PageProps<"/[locale]/support/[token]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}
