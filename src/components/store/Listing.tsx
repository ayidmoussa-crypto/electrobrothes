import { ChevronLeft, ChevronRight, PackageOpen, SlidersHorizontal, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/States";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/catalog";
import { applyListing, buildFacets, listingQuery, parseListingParams, SORTS, type ListingParams } from "@/lib/listing";
import { ProductGrid } from "./ProductGrid";
import { SortSelect } from "./SortSelect";

type Raw = Record<string, string | string[] | undefined>;

/**
 * One listing for category and search pages: GET-form filters (work without JS and for
 * shopping agents), active-filter chips, sort, numbered pagination. All state is in the URL.
 */
export async function Listing({
  locale,
  basePath,
  items,
  searchParams,
  q,
  empty,
}: {
  locale: Locale;
  basePath: string;
  items: ProductCardData[];
  searchParams: Raw;
  q?: string;
  empty?: ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "listing" });
  const params = parseListingParams(searchParams);
  const facets = buildFacets(items);
  const result = applyListing(items, params);
  const action = getPathname({ href: basePath, locale });

  const gb = (v: number) => (v >= 1024 ? t("tb", { value: v / 1024 }) : t("gb", { value: v }));
  const inch = (v: number) => t("inch", { value: v });
  const href = (p: Partial<ListingParams>) => `${basePath}${listingQuery({ ...params, ...p, q })}`;

  // Active filter chips, each linking to the same URL without that one value.
  const chips: { key: string; label: string; href: string }[] = [
    ...params.brands.map((v) => ({ key: `b${v}`, label: facets.brands.find((b) => b.value === v)?.label ?? v, href: href({ brands: params.brands.filter((x) => x !== v), page: 1 }) })),
    ...params.ram.map((v) => ({ key: `r${v}`, label: `RAM ${gb(v)}`, href: href({ ram: params.ram.filter((x) => x !== v), page: 1 }) })),
    ...params.storage.map((v) => ({ key: `s${v}`, label: gb(v), href: href({ storage: params.storage.filter((x) => x !== v), page: 1 }) })),
    ...params.cpu.map((v) => ({ key: `c${v}`, label: v, href: href({ cpu: params.cpu.filter((x) => x !== v), page: 1 }) })),
    ...params.screen.map((v) => ({ key: `sc${v}`, label: inch(v), href: href({ screen: params.screen.filter((x) => x !== v), page: 1 }) })),
    ...(params.min ? [{ key: "min", label: `≥ ${params.min}`, href: href({ min: null, page: 1 }) }] : []),
    ...(params.max ? [{ key: "max", label: `≤ ${params.max}`, href: href({ max: null, page: 1 }) }] : []),
    ...(params.inStock ? [{ key: "stock", label: t("inStockOnly"), href: href({ inStock: false, page: 1 }) }] : []),
  ];

  const checkboxGroup = <V extends string | number>(
    name: string,
    legend: string,
    options: { value: V; count: number; label?: string }[],
    selected: V[],
    format: (v: V) => string = String,
  ) =>
    options.length ? (
      <fieldset className="border-t border-warm-200 py-4">
        <legend className="text-sm font-bold text-ink">{legend}</legend>
        <ul className="mt-2 flex flex-col">
          {options.map((o) => (
            <li key={String(o.value)}>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-warm-800">
                <input
                  type="checkbox"
                  name={name}
                  value={String(o.value)}
                  defaultChecked={selected.includes(o.value)}
                  className="size-5 cursor-pointer accent-ink"
                />
                <span className="flex-1">{o.label ?? format(o.value)}</span>
                <span className="text-xs text-warm-500">{o.count}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    ) : null;

  const filters = (
    <form action={action} method="get" className="flex flex-col">
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {params.sort !== "featured" ? <input type="hidden" name="sort" value={params.sort} /> : null}
      {checkboxGroup("brand", t("brand"), facets.brands, params.brands)}
      <fieldset className="border-t border-warm-200 py-4">
        <legend className="text-sm font-bold text-ink">{t("price")}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["min", "max"] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-warm-600">
              {t(k)}
              <input
                type="number"
                name={k}
                inputMode="numeric"
                min={0}
                defaultValue={params[k] ?? ""}
                placeholder={k === "max" ? String(facets.priceMax) : "0"}
                className="min-h-11 w-full rounded-lg border border-warm-200 bg-warm-100 px-3 text-base text-warm-800 placeholder:text-warm-400"
              />
            </label>
          ))}
        </div>
      </fieldset>
      {checkboxGroup("ram", t("ram"), facets.ram, params.ram, gb)}
      {checkboxGroup("storage", t("storage"), facets.storage, params.storage, gb)}
      {checkboxGroup("cpu", t("cpu"), facets.cpu, params.cpu)}
      {checkboxGroup("screen", t("screen"), facets.screen, params.screen, inch)}
      <fieldset className="border-t border-warm-200 py-4">
        <legend className="text-sm font-bold text-ink">{t("availability")}</legend>
        <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-3 text-sm text-warm-800">
          <input type="checkbox" name="stock" value="1" defaultChecked={params.inStock} className="size-5 cursor-pointer accent-ink" />
          {t("inStockOnly")}
        </label>
      </fieldset>
      <div className="sticky bottom-0 flex gap-2 border-t border-warm-200 bg-white py-3">
        <button type="submit" className={buttonClass({ className: "flex-1" })}>
          {t("apply")}
        </button>
        {chips.length ? (
          <Link href={`${basePath}${listingQuery({ q })}`} className={buttonClass({ variant: "outline" })}>
            {t("clearAll")}
          </Link>
        ) : null}
      </div>
    </form>
  );

  const Prev = locale === "ar" ? ChevronRight : ChevronLeft;
  const Next = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside aria-label={t("filters")} className="hidden lg:block">
        <h2 className="text-lg">{t("filters")}</h2>
        {filters}
      </aside>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-warm-800" aria-live="polite">
            {t("results", { count: result.total })}
          </p>
          <div className="flex items-center gap-2">
            <form action={action} method="get" className="flex items-center gap-2">
              {Object.entries(Object.fromEntries(new URLSearchParams(listingQuery({ ...params, sort: "featured", page: 1, q }).slice(1)))).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <label htmlFor="listing-sort" className="sr-only sm:not-sr-only sm:text-sm sm:text-warm-600">
                {t("sortLabel")}
              </label>
              <SortSelect id="listing-sort" defaultValue={params.sort}>
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sort.${s}`)}
                  </option>
                ))}
              </SortSelect>
              <noscript>
                <button type="submit" className={buttonClass({ variant: "outline" })}>
                  {t("apply")}
                </button>
              </noscript>
            </form>
          </div>
        </div>

        {/* Mobile: filters fold out under the toolbar and are applied in one go. */}
        <details className="mb-4 lg:hidden">
          <summary
            className={buttonClass({ variant: "outline", className: "w-full list-none [&::-webkit-details-marker]:hidden" })}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {t("showFilters")}
            {chips.length ? <span className="rounded-full bg-ink px-2 text-xs text-white">{chips.length}</span> : null}
          </summary>
          <div className="mt-2 rounded-xl border border-warm-200 px-4">{filters}</div>
        </details>

        {chips.length ? (
          <div className="mb-4">
            <h2 className="sr-only">{t("activeFilters")}</h2>
            <ul className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    aria-label={t("remove", { label: c.label })}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full bg-yellow-100 px-3 text-sm font-medium text-yellow-900 hover:bg-yellow-200"
                  >
                    {c.label}
                    <X className="size-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.items.length ? (
          <>
            {/* Keeps the outline h1 → h2 → h3 (product cards) for screen readers. */}
            <h2 className="sr-only">{t("results", { count: result.total })}</h2>
            <ProductGrid products={result.items} locale={locale} priorityCount={2} />
          </>
        ) : (
          (empty ?? <EmptyListing locale={locale} clearHref={chips.length ? `${basePath}${listingQuery({ q })}` : undefined} />)
        )}

        {result.pages > 1 ? (
          <nav aria-label={t("pagination")} className="mt-8 flex items-center justify-center gap-1">
            {result.page > 1 ? (
              <Link href={href({ page: result.page - 1 })} rel="prev" aria-label={t("previous")} className={buttonClass({ variant: "outline", size: "icon" })}>
                <Prev className="size-5" aria-hidden="true" />
              </Link>
            ) : null}
            {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={href({ page: n })}
                aria-current={n === result.page ? "page" : undefined}
                aria-label={t("pageOf", { page: n, pages: result.pages })}
                className={buttonClass({ variant: n === result.page ? "dark" : "ghost", size: "icon" })}
              >
                {n}
              </Link>
            ))}
            {result.page < result.pages ? (
              <Link href={href({ page: result.page + 1 })} rel="next" aria-label={t("next")} className={buttonClass({ variant: "outline", size: "icon" })}>
                <Next className="size-5" aria-hidden="true" />
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

async function EmptyListing({ locale, clearHref }: { locale: Locale; clearHref?: string }) {
  const [states, t] = await Promise.all([
    getTranslations({ locale, namespace: "states" }),
    getTranslations({ locale, namespace: "listing" }),
  ]);
  return (
    <StatePanel
      icon={PackageOpen}
      title={states("emptyTitle")}
      description={states("emptyText")}
      action={
        clearHref ? (
          <Link href={clearHref} className={buttonClass()}>
            {t("clearAll")}
          </Link>
        ) : null
      }
    />
  );
}
