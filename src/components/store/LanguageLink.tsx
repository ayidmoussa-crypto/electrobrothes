"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

/** Switches the language and stays on the same page (and the same filters), instead of going to the homepage. */
export function LanguageLink({ className, children, onNavigate }: { className?: string; children: ReactNode; onNavigate?: () => void }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      className={className}
      onClick={(e) => {
        // Keep the query string (?q=, ?page=...) too; only known to the browser.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate?.();
        router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale: other });
      }}
    >
      {children}
    </Link>
  );
}
