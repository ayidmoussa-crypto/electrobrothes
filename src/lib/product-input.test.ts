import assert from "node:assert/strict";
import { test } from "node:test";
import { productInput, slugify } from "./product-input";

const valid = {
  slug: "iphone-16",
  nameAr: "آيفون 16",
  nameEn: "iPhone 16",
  descriptionAr: "وصف المنتج بالعربية",
  descriptionEn: "Product description",
  categoryId: "c1",
  brandId: "b1",
  warrantyMonths: "12",
  isActive: true,
  isFeatured: false,
  isBestSeller: false,
  dealEndsAt: "",
  images: [{ url: "https://res.cloudinary.com/x/image.jpg", altAr: "صورة", altEn: "Image" }],
  variants: [{ sku: "ip16-128", colorAr: "", colorEn: "", colorHex: "", storage: "128GB", price: "9999", compareAtPrice: "", stock: "5" }],
  specs: [{ key: "ram", valueAr: "8 جيجابايت", valueEn: "8 GB", numericValue: "8" }],
};

test("a complete product parses and normalizes form strings", () => {
  const p = productInput.parse(valid);
  assert.equal(p.variants[0].sku, "IP16-128");
  assert.equal(p.variants[0].price, 9999);
  assert.equal(p.variants[0].compareAtPrice, null);
  assert.equal(p.variants[0].colorAr, null);
  assert.equal(p.specs[0].numericValue, 8);
  assert.equal(p.dealEndsAt, null);
});

test("refuses what would break the storefront", () => {
  const issues = (over: object) => productInput.safeParse({ ...valid, ...over }).error?.issues.map((i) => i.message) ?? [];
  assert.ok(issues({ slug: "آيفون" }).includes("slug"));
  assert.ok(issues({ images: [] }).includes("images"));
  assert.ok(issues({ images: [{ url: "javascript:alert(1)", altAr: "", altEn: "" }] }).includes("image"));
  assert.ok(issues({ variants: [] }).includes("variants"));
  assert.ok(issues({ variants: [{ ...valid.variants[0], price: "0" }] }).includes("price"));
  assert.ok(issues({ variants: [valid.variants[0], { ...valid.variants[0] }] }).includes("duplicateSku"));
  assert.ok(issues({ variants: [{ ...valid.variants[0], compareAtPrice: "9000" }] }).includes("compareAt"));
});

test("slugs are latin, lowercase and dashed", () => {
  assert.equal(slugify("Galaxy Tab A9+ (2024)"), "galaxy-tab-a9-2024");
  assert.equal(slugify("  MacBook   Air_13  "), "macbook-air-13");
});
