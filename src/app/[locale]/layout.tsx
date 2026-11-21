import { Truck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Pixels } from "@/components/analytics/Pixels";
import { VisitTracker } from "@/components/analytics/VisitTracker";
import { Toaster } from "@/components/ui/Toaster";
import { Footer } from "@/components/store/Footer";
import { WhatsAppButton } from "@/components/store/WhatsAppButton";
import { Header } from "@/components/store/Header";
import { dirOf, routing } from "@/i18n/routing";
import { SITE_NAME, siteUrl } from "@/lib/seo";
import { fontClasses } from "../fonts";
import "../globals.css";

// Namespaces used with useTranslations() in client components. Add one here when a client component needs it.
const CLIENT_NAMESPACES = ["header", "pdp", "product", "cart", "checkout", "trust", "order", "track", "states", "countdown", "brands", "reviewForm", "emailBox", "bundles", "giveaway", "support"] as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl()),
    // Pages set a plain title ("Phones"); the template adds the brand once.
    title: { default: t("title"), template: `%s | ${SITE_NAME}` },
    description: t("description"),
    applicationName: SITE_NAME,
    formatDetection: { telephone: false },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [t, a11y, states, messages] = await Promise.all([getTranslations("topbar"), getTranslations("a11y"), getTranslations("states"), getMessages()]);
  // Only the namespaces client components read are serialized into the page (smaller HTML, faster hydration).
  const clientMessages = Object.fromEntries(CLIENT_NAMESPACES.map((ns) => [ns, messages[ns]]));

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${fontClasses} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* The localized <Link> is a client component and reads the locale from here. */}
        <NextIntlClientProvider messages={clientMessages}>
          <a
            href="#main"
            className="sr-only z-50 rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
          >
            {a11y("skipToContent")}
          </a>
          <div className="relative z-10 bg-deep px-4 py-2 text-white">
            <p className="mx-auto flex items-center justify-center gap-2 text-xs font-semibold tracking-wide sm:text-[13px]">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-yellow-500 text-ink">
                <Truck className="size-3" aria-hidden="true" />
              </span>
              <span>{t("cod")}</span>
            </p>
            {/* A thin yellow glow along the bottom edge: the brand's energy line above the header. */}
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
          </div>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer locale={locale} />
          <WhatsAppButton locale={locale} />
          <Pixels />
          <VisitTracker />
          <Toaster closeLabel={states("closeToast")} failed={states("requestFailed")} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
