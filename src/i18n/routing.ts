import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Arabic lives at "/", English at "/en". No Accept-Language redirects:
  // every URL is stable for shoppers, crawlers and shopping agents.
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const dirOf = (locale: Locale) => (locale === "ar" ? "rtl" : "ltr");
