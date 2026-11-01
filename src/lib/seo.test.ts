import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonLd, localizedPath, pageMetadata } from "./seo";

test("Arabic is the unprefixed default, English lives under /en", () => {
  assert.equal(localizedPath("ar", "/"), "/");
  assert.equal(localizedPath("en", "/"), "/en");
  assert.equal(localizedPath("ar", "/products/iphone-15"), "/products/iphone-15");
  assert.equal(localizedPath("en", "/products/iphone-15"), "/en/products/iphone-15");
});

test("pages are self-canonical with hreflang for both languages", () => {
  const m = pageMetadata({ locale: "en", path: "/category/phones", title: "Phones", description: "d" });
  assert.equal(m.alternates?.canonical, "/en/category/phones");
  assert.deepEqual(m.alternates?.languages, { ar: "/category/phones", en: "/en/category/phones", "x-default": "/category/phones" });
  assert.equal(m.robots, undefined);
  assert.deepEqual(pageMetadata({ locale: "ar", path: "/x", title: "t", description: "d", noindex: true }).robots, { index: false, follow: true });
});

test("JSON-LD cannot break out of its script tag", () => {
  const out = jsonLd({ name: "</script><script>alert(1)</script>" });
  assert.ok(!out.includes("</script>"));
  assert.deepEqual(JSON.parse(out), { name: "</script><script>alert(1)</script>" });
});
