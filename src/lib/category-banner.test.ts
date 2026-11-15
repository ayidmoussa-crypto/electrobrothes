import assert from "node:assert/strict";
import { test } from "node:test";
import { bannerImageList } from "./category-banner";

test("banner pictures: one per line, secure links or own files, no repeats, three at most", () => {
  const typed = [
    "  https://res.cloudinary.com/x/image/upload/a.webp ",
    "",
    "http://insecure.example/b.jpg",
    "/banners/prime.webp",
    "https://res.cloudinary.com/x/image/upload/a.webp",
    "javascript:alert(1)",
    "https://res.cloudinary.com/x/c.png",
    "https://res.cloudinary.com/x/d.png",
  ].join("\r\n");
  assert.deepEqual(bannerImageList(typed), ["https://res.cloudinary.com/x/image/upload/a.webp", "/banners/prime.webp", "https://res.cloudinary.com/x/c.png"]);
  assert.deepEqual(bannerImageList(""), []);
});
