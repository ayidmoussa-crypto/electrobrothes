import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getCheckoutConfig } from "@/lib/store-config";

/** WhatsApp's own glyph (brand mark, not a Lucide icon). */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" />
    </svg>
  );
}

/**
 * Floating WhatsApp chat button (the only place #25D366 is used). Hidden until a number is set
 * in the admin settings. Low in the corner, and lifted above the order bar on phones where a page has one. See-through at rest so it
 * does not cover what is under it, solid as soon as the shopper reaches for it.
 */
export async function WhatsAppButton({ locale }: { locale: Locale }) {
  const [{ whatsappNumber }, t] = await Promise.all([getCheckoutConfig(), getTranslations({ locale, namespace: "whatsapp" })]);
  const number = whatsappNumber.replace(/\D/g, "");
  if (!number) return null;

  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(t("message"))}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("label")}
      className="fixed end-4 bottom-6 z-40 grid max-lg:[html[data-order-bar]_&]:bottom-24 size-14 place-items-center rounded-full bg-whatsapp text-ink opacity-65 shadow-lg shadow-ink/20 transition-[transform,opacity] duration-200 hover:scale-105 hover:opacity-100 focus-visible:opacity-100 active:scale-95 active:opacity-100"
    >
      <WhatsAppGlyph className="size-7" />
    </a>
  );
}
