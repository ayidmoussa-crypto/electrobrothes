import assert from "node:assert/strict";
import { test } from "node:test";
import { applyListing, buildFacets, listingQuery, PAGE_SIZE, parseListingParams } from "./listing";

const base = {
  slug: "",
  brand: "Brand",
  brandSlug: "brand",
  minPrice: 1000,
  stock: 5,
  isBestSeller: false,
  isFeatured: false,
  createdAt: 0,
  rating: null as number | null,
  reviewCount: 0,
  facets: { ram: null as number | null, storage: [] as number[], cpu: null as string | null, screen: null as number | null },
};
const item = (over: Partial<typeof base> & { slug: string }) => ({ ...base, ...over });

const items = [
  item({ slug: "a", brandSlug: "apple", brand: "Apple", minPrice: 9000, facets: { ram: 8, storage: [128, 256], cpu: "A16", screen: 6.1 } }),
  item({ slug: "b", brandSlug: "samsung", brand: "Samsung", minPrice: 4000, facets: { ram: 8, storage: [128], cpu: "Exynos", screen: 6.6 } }),
  item({ slug: "c", brandSlug: "xiaomi", brand: "Xiaomi", minPrice: 2800, stock: 0, facets: { ram: 12, storage: [512], cpu: "Dimensity", screen: 6.67 } }),
];

test("parses URL params defensively", () => {
  const p = parseListingParams({ brand: "apple,samsung", ram: ["8", "x"], min: "-5", sort: "evil", page: "0", stock: "1" });
  assert.deepEqual(p.brands, ["apple", "samsung"]);
  assert.deepEqual(p.ram, [8]);
  assert.equal(p.min, null);
  assert.equal(p.sort, "featured");
  assert.equal(p.page, 1);
  assert.equal(p.inStock, true);
});

test("filters by brand, specs, price and stock together", () => {
  const slugs = (raw: Record<string, string>) => applyListing(items, parseListingParams(raw)).items.map((i) => i.slug);
  assert.deepEqual(slugs({ brand: "apple,samsung", sort: "price-asc" }), ["b", "a"]);
  assert.deepEqual(slugs({ storage: "256" }), ["a"]);
  assert.deepEqual(slugs({ ram: "12" }), ["c"]);
  assert.deepEqual(slugs({ max: "5000", sort: "price-asc" }), ["c", "b"]);
  assert.deepEqual(slugs({ max: "5000", stock: "1" }), ["b"]);
});

test("featured sort puts out-of-stock products last", () => {
  const out = applyListing(items, parseListingParams({})).items.map((i) => i.slug);
  assert.equal(out.at(-1), "c");
});

test("paginates and clamps an out-of-range page", () => {
  const many = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => item({ slug: `p${i}`, minPrice: i + 1 }));
  const last = applyListing(many, parseListingParams({ page: "99", sort: "price-asc" }));
  assert.equal(last.pages, 2);
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 3);
});

test("facets list each value with a count and hide single-value facets", () => {
  const f = buildFacets(items);
  assert.deepEqual(f.ram, [{ value: 8, count: 2 }, { value: 12, count: 1 }]);
  assert.deepEqual(f.storage.map((o) => o.value), [128, 256, 512]);
  assert.equal(f.brands.length, 3);
  assert.deepEqual(buildFacets([items[0]]).ram, []);
});

test("listing URLs drop defaults", () => {
  assert.equal(listingQuery({ sort: "featured", page: 1 }), "");
  assert.equal(listingQuery({ brands: ["apple"], sort: "price-asc", page: 2 }), "?brand=apple&sort=price-asc&page=2");
});
