import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/catalog";
import { ProductCard } from "./ProductCard";

export const gridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";

export function ProductGrid({ products, locale, priorityCount = 0 }: { products: ProductCardData[]; locale: Locale; priorityCount?: number }) {
  return (
    <ul className={gridClass}>
      {products.map((p, i) => (
        <li key={p.slug} className="flex">
          <div className="flex-1">
            <ProductCard product={p} locale={locale} priority={i < priorityCount} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
  locale,
  aside,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  locale: Locale;
  aside?: ReactNode;
}) {
  const Arrow = locale === "ar" ? ChevronLeft : ChevronRight;
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl md:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-warm-600">{subtitle}</p> : null}
      </div>
      {aside}
      {href && linkLabel ? (
        <Link href={href} className="inline-flex min-h-11 items-center gap-1 font-semibold text-ink underline-offset-4 hover:underline">
          {linkLabel}
          <Arrow className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
