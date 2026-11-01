import type { Locale } from "@/i18n/routing";

// ar-MA and fr-MA group thousands with "." (8.490), which reads like a decimal;
// fr-FR gives the "8 490" spacing Moroccan shops use.
const arNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const en = new Intl.NumberFormat("en-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 });

/** Whole dirhams → "8 490 د.م." (ar) / "MAD 8,490" (en). */
export const formatMAD = (amount: number, locale: Locale) =>
  locale === "ar" ? `${arNumber.format(amount)} د.م.` : en.format(amount);
