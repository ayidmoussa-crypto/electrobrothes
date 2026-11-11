// Shared by server and client admin code: no server-only imports here.

export type AdminLang = "ar" | "en";
export type Tr = (ar: string, en: string) => string;

/** Each admin text is written in both languages side by side; this picks the panel's one. */
export const tr =
  (lang: AdminLang): Tr =>
  (ar, en) =>
    lang === "ar" ? ar : en;

/** Locale tag for Intl dates and numbers in the panel. */
export const adminLocale = (lang: AdminLang) => (lang === "ar" ? "ar-MA" : "en-GB");
