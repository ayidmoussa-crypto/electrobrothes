import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Pixels } from "@/components/analytics/Pixels";
import { Footer } from "@/components/store/Footer";
import { WhatsAppButton } from "@/components/store/WhatsAppButton";
import { Header } from "@/components/store/Header";
import { dirOf, routing } from "@/i18n/routing";
import { SITE_NAME, siteUrl } from "@/lib/seo";
import { fontClasses } from "../fonts";
import "../globals.css";

// Namespaces used with useTranslations() in client components. Add one here when a client component needs it.
const CLIENT_NAMESPACES = ["header", "pdp", "product", "cart", "checkout", "order", "track", "states", "countdown", "brands"] as const;

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
  const [t, a11y, messages] = await Promise.all([getTranslations("topbar"), getTranslations("a11y"), getMessages()]);
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
          <p className="bg-deep px-4 py-2 text-center text-xs font-medium text-warm-300">{t("cod")}</p>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer locale={locale} />
          <WhatsAppButton locale={locale} />
          <Pixels />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
