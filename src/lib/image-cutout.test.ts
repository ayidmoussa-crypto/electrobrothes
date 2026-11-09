import assert from "node:assert/strict";
import { test } from "node:test";
import { cutoutUrl } from "./image-cutout";

test("a Cloudinary photo gets its white background removed, as PNG", () => {
  assert.equal(
    cutoutUrl("https://res.cloudinary.com/x/image/upload/v1/products/a.webp"),
    "https://res.cloudinary.com/x/image/upload/co_white,e_make_transparent:10/f_png/v1/products/a.webp",
  );
});

test("a photo from anywhere else has no cutout", () => {
  assert.equal(cutoutUrl("/images/pack.svg"), null);
  assert.equal(cutoutUrl("https://example.com/image/upload/a.jpg"), null);
});
