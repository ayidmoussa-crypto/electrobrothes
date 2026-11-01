// Filtering, sorting and pagination for product listings (category + search).
// Pure functions over already-loaded cards, all state lives in the URL.
// shortcut: filters run in memory on the whole category; move them into SQL when a category passes ~1000 products.

import type { ProductCardData } from "./catalog";

export const PAGE_SIZE = 12;
export const SORTS = ["featured", "price-asc", "price-desc", "newest", "rating"] as const;
export type Sort = (typeof SORTS)[number];

type Item = Pick<
  ProductCardData,
  "brandSlug" | "minPrice" | "stock" | "isBestSeller" | "isFeatured" | "createdAt" | "rating" | "reviewCount" | "facets"
>;

export type ListingParams = {
  brands: string[];
  ram: number[];
  storage: number[];
  cpu: string[];
  screen: number[];
  min: number | null;
  max: number | null;
  inStock: boolean;
  sort: Sort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((s) => s.split(",")).filter(Boolean);
const numbers = (v: string | string[] | undefined) => list(v).map(Number).filter((n) => Number.isFinite(n) && n > 0);
const positiveInt = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function parseListingParams(raw: RawParams): ListingParams {
  const sort = (Array.isArray(raw.sort) ? raw.sort[0] : raw.sort) as Sort;
  return {
    brands: list(raw.brand),
    ram: numbers(raw.ram),
    storage: numbers(raw.storage),
    cpu: list(raw.cpu),
    screen: numbers(raw.screen),
    min: positiveInt(raw.min),
    max: positiveInt(raw.max),
    inStock: raw.stock === "1",
    sort: SORTS.includes(sort) ? sort : "featured",
    page: positiveInt(raw.page) ?? 1,
  };
}

export function matches<T extends Item>(item: T, p: ListingParams) {
  const f = item.facets;
  if (p.brands.length && !p.brands.includes(item.brandSlug)) return false;
  if (p.ram.length && (f.ram === null || !p.ram.includes(f.ram))) return false;
  if (p.storage.length && !f.storage.some((s) => p.storage.includes(s))) return false;
  if (p.cpu.length && (f.cpu === null || !p.cpu.includes(f.cpu))) return false;
  if (p.screen.length && (f.screen === null || !p.screen.includes(f.screen))) return false;
  if (p.min !== null && item.minPrice < p.min) return false;
  if (p.max !== null && item.minPrice > p.max) return false;
  if (p.inStock && item.stock <= 0) return false;
  return true;
}

const comparators: Record<Sort, (a: Item, b: Item) => number> = {
  // Featured: in stock first, then featured, then best sellers, then newest.
  featured: (a, b) =>
    Number(b.stock > 0) - Number(a.stock > 0) ||
    Number(b.isFeatured) - Number(a.isFeatured) ||
    Number(b.isBestSeller) - Number(a.isBestSeller) ||
    b.createdAt - a.createdAt,
  "price-asc": (a, b) => a.minPrice - b.minPrice,
  "price-desc": (a, b) => b.minPrice - a.minPrice,
  newest: (a, b) => b.createdAt - a.createdAt,
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount,
};

export function applyListing<T extends Item>(items: T[], p: ListingParams) {
  const filtered = items.filter((i) => matches(i, p)).sort(comparators[p.sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(p.page, pages);
  return { items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: filtered.length, page, pages };
}

export type FacetOption<V> = { value: V; count: number };

/** Options per facet with product counts; a facet with fewer than 2 options is not worth showing. */
export function buildFacets<T extends Item & { brand: string }>(items: T[]) {
  const count = <V>(values: V[]) => {
    const m = new Map<V, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m].map(([value, c]) => ({ value, count: c }));
  };
  const byNumber = <V extends number>(a: FacetOption<V>[]) => a.sort((x, y) => x.value - y.value);
  const keep = <V>(a: FacetOption<V>[]) => (a.length >= 2 ? a : []);

  const brandNames = new Map(items.map((i) => [i.brandSlug, i.brand]));
  return {
    brands: keep(count(items.map((i) => i.brandSlug)))
      .map((o) => ({ ...o, label: brandNames.get(o.value)! }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ram: keep(byNumber(count(items.flatMap((i) => (i.facets.ram === null ? [] : [i.facets.ram]))))),
    storage: keep(byNumber(count(items.flatMap((i) => i.facets.storage)))),
    cpu: keep(count(items.flatMap((i) => (i.facets.cpu === null ? [] : [i.facets.cpu]))).sort((a, b) => a.value.localeCompare(b.value))),
    screen: keep(byNumber(count(items.flatMap((i) => (i.facets.screen === null ? [] : [i.facets.screen]))))),
    priceMax: items.reduce((m, i) => Math.max(m, i.minPrice), 0),
  };
}

export type Facets = ReturnType<typeof buildFacets>;

/** Query string for a listing URL, dropping defaults so canonical URLs stay short. */
export function listingQuery(p: Partial<ListingParams> & { q?: string }) {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.brands?.length) s.set("brand", p.brands.join(","));
  if (p.ram?.length) s.set("ram", p.ram.join(","));
  if (p.storage?.length) s.set("storage", p.storage.join(","));
  if (p.cpu?.length) s.set("cpu", p.cpu.join(","));
  if (p.screen?.length) s.set("screen", p.screen.join(","));
  if (p.min) s.set("min", String(p.min));
  if (p.max) s.set("max", String(p.max));
  if (p.inStock) s.set("stock", "1");
  if (p.sort && p.sort !== "featured") s.set("sort", p.sort);
  if (p.page && p.page > 1) s.set("page", String(p.page));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}
