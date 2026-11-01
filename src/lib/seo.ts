import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";

export const SITE_NAME = "ElectroBrothers";

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Arabic lives at "/", English at "/en" (localePrefix: as-needed). */
export const localizedPath = (locale: Locale, path: string) => {
  const clean = path === "/" ? "" : path;
  return locale === "ar" ? clean || "/" : `/en${clean}`;
};
export const absoluteUrl = (locale: Locale, path: string) => `${siteUrl()}${localizedPath(locale, path)}`;

/**
 * Per-page metadata: unique title + description, self-canonical, hreflang alternates for both
 * languages (x-default = Arabic), Open Graph and Twitter cards.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
  noindex = false,
  fullTitle = false,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image?: string | null;
  noindex?: boolean;
  /** The title is written for search results as it is: the "| ElectroBrothers" template would break its length. */
  fullTitle?: boolean;
}): Metadata {
  const url = localizedPath(locale, path);
  // A page-level openGraph replaces the inherited one, so the brand image (app/[locale]/opengraph-image) is set explicitly.
  const images = [image ? { url: image } : { url: localizedPath(locale, "/opengraph-image"), width: 1200, height: 630 }];
  return {
    title: fullTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      languages: { ar: localizedPath("ar", path), en: localizedPath("en", path), "x-default": localizedPath("ar", path) },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "ar" ? "ar_MA" : "en_US",
      alternateLocale: locale === "ar" ? "en_US" : "ar_MA",
      url,
      title,
      description,
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Safe JSON for a <script type="application/ld+json">: "<" can never close the script tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
