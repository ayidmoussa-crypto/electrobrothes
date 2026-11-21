import { Pagination as PageRow } from "@/components/ui/Pagination";
import type { Tr } from "@/lib/admin-lang";
import { pageCount, pageRange } from "@/lib/pagination";

/**
 * The page row under an admin list: "Showing 26–50 of 120", previous and next, and the page numbers. Nothing when
 * everything fits on one page. `href` builds the address of a page and keeps the list's filters (see pageHref).
 */
export function Pagination({ page, total, size, href, tr, className }: { page: number; total: number; size: number; href: (page: number) => string; tr: Tr; className?: string }) {
  const { from, to } = pageRange(page, size, total);
  return (
    <PageRow
      page={page}
      pages={pageCount(total, size)}
      href={href}
      compact
      className={className}
      labels={{ nav: tr("الصفحات", "Pages"), previous: tr("الصفحة السابقة", "Previous page"), next: tr("الصفحة التالية", "Next page") }}
      summary={
        <>
          {tr("عرض", "Showing")} <bdi dir="ltr">{from}–{to}</bdi> {tr("من", "of")} <bdi dir="ltr">{total}</bdi>
        </>
      }
    />
  );
}

/**
 * The address of a page of a list at `path`, keeping its filters; page 1 has no page in the address. `key` is the
 * name of the page in the address (a screen with two lists gives each its own), `hash` where the page should land.
 */
export function pageHref(path: string, filters: Record<string, string | undefined>, page: number, { key = "page", hash }: { key?: string; hash?: string } = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  if (page > 1) params.set(key, String(page));
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
