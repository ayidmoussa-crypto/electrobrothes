import assert from "node:assert/strict";
import { test } from "node:test";
import { colorName, nameColors } from "./color-names";

test("a swatch gets the closest common colour name", () => {
  assert.deepEqual(colorName("#000000"), { ar: "أسود", en: "Black" });
  assert.deepEqual(colorName("#FFFFFF"), { ar: "أبيض", en: "White" });
  assert.equal(colorName("#1d4ed8").en, "Blue");
  assert.equal(colorName("#dc2626").en, "Red");
  assert.equal(colorName("#c0c0c0").en, "Silver");
});

test("two different swatches with the same name are numbered; the same swatch keeps one name", () => {
  const out = nameColors([
    { colorHex: "#1e63d6", colorAr: null, colorEn: null },
    { colorHex: "#2563eb", colorAr: null, colorEn: null },
    { colorHex: "#1E63D6", colorAr: null, colorEn: null },
  ]);
  assert.deepEqual(
    out.map((v) => v.colorEn),
    ["Blue", "Blue 2", "Blue"],
  );
  assert.equal(out[1].colorAr, "أزرق 2");
});

test("a colour without a swatch keeps the name it had", () => {
  const [v] = nameColors([{ colorHex: null, colorAr: "أسود ليلي", colorEn: "Midnight" }]);
  assert.equal(v.colorAr, "أسود ليلي");
});
