import { ChevronLeft, ChevronRight } from "lucide-react";
import NextLink from "next/link";
import type { ComponentType, ReactNode } from "react";
import { pageItems } from "@/lib/pagination";
import { buttonClass } from "./button";

// The one page row of the whole project: the shop's listings and every admin list use it. It is a plain server
// component made of links, so paging works without JavaScript and search engines can follow it. Each place gives it
// its own link component (the shop's keeps the language in the address), its own words and the address of a page.

type PageLinkProps = { href: string; rel?: string; title?: string; className?: string; children?: ReactNode; "aria-label"?: string; "aria-current"?: "page" };

export type PaginationLabels = {
  /** Names the whole row for screen readers. */
  nav: string;
  previous: string;
  next: string;
  /** Names a page number, e.g. "Page 3 of 9". */
  page?: (n: number) => string;
};

export function Pagination({
  page,
  pages,
  href,
  labels,
  link: Link = NextLink,
  summary,
  compact = false,
  className = "",
}: {
  page: number;
  pages: number;
  /** The address of a page, keeping the list's filters. */
  href: (page: number) => string;
  labels: PaginationLabels;
  /** The link component to use. The default is Next's. */
  link?: ComponentType<PageLinkProps>;
  /** Text on the start side, e.g. "Showing 26–50 of 120". */
  summary?: ReactNode;
  /** Slightly smaller buttons on a phone, so a long row still fits one line (admin lists). */
  compact?: boolean;
  className?: string;
}) {
  if (pages <= 1) return null;
  const size = compact ? "size-9! sm:size-11!" : "";
  // The arrows turn round in Arabic, where "next" is on the left.
  const step = (target: number, label: string, enabled: boolean, rel: "prev" | "next", Icon: typeof ChevronLeft) =>
    enabled ? (
      <Link href={href(target)} rel={rel} aria-label={label} title={label} className={buttonClass({ variant: "outline", size: "icon", className: size })}>
        <Icon className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Link>
    ) : (
      <span aria-hidden="true" className={buttonClass({ variant: "outline", size: "icon", className: `${size} pointer-events-none opacity-40` })}>
        <Icon className="size-4 rtl:rotate-180" aria-hidden="true" />
      </span>
    );

  return (
    <div className={`mt-4 flex flex-wrap items-center gap-3 ${summary ? "justify-between" : "justify-center"} ${className}`}>
      {summary ? <p className="text-sm text-warm-600 tabular-nums">{summary}</p> : null}
      <nav aria-label={labels.nav} className={`flex flex-wrap items-center ${compact ? "gap-0.5 sm:gap-1" : "gap-1"}`}>
        {step(page - 1, labels.previous, page > 1, "prev", ChevronLeft)}
        {pageItems(page, pages).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} aria-hidden="true" className={`grid place-items-center text-warm-500 ${compact ? "size-6 sm:size-8" : "size-8"}`}>
              …
            </span>
          ) : (
            <Link
              key={n}
              href={href(n)}
              aria-current={n === page ? "page" : undefined}
              aria-label={labels.page?.(n)}
              className={buttonClass({ variant: n === page ? "dark" : "ghost", size: "icon", className: size })}
            >
              {n}
            </Link>
          ),
        )}
        {step(page + 1, labels.next, page < pages, "next", ChevronRight)}
      </nav>
    </div>
  );
}
