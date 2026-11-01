import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function Breadcrumbs({ locale, items }: { locale: Locale; items: { href?: string; label: string }[] }) {
  const t = await getTranslations({ locale, namespace: "pdp" });
  const Sep = locale === "ar" ? ChevronLeft : ChevronRight;
  const all = [{ href: "/", label: t("home") }, ...items];

  return (
    <nav aria-label={t("breadcrumb")} className="py-3 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-warm-600">
        {all.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 ? <Sep className="size-3.5 text-warm-400" aria-hidden="true" /> : null}
            {item.href && i < all.length - 1 ? (
              <Link href={item.href} className="underline-offset-4 hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
