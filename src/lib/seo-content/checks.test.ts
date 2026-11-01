import assert from "node:assert/strict";
import { test } from "node:test";
import { containsKeyword, cutText, languageScore, normalizeText, scoreTone, seoChecks, seoResult, type ScoreInput } from "./checks";

const full: ScoreInput = {
  slug: "sony-wh-1000xm5",
  metaTitleAr: "سماعة سوني WH-1000XM5 ثمن في المغرب",
  metaTitleEn: "Sony WH-1000XM5 Headphones Price Morocco",
  metaDescriptionAr: "سماعة سوني WH-1000XM5 الأصلية بإلغاء الضوضاء. اكتشف الثمن في المغرب واطلبها الآن مع الدفع عند الاستلام والتوصيل لجميع المدن.",
  metaDescriptionEn: "Sony WH-1000XM5 headphones with noise cancelling. See the price in Morocco and order now with cash on delivery to every city in the country.",
  descriptionAr: "س".repeat(160),
  descriptionEn: "s".repeat(160),
  focusKeywordAr: "سماعة سوني WH-1000XM5",
  focusKeywordEn: "Sony WH-1000XM5",
  images: [{ altAr: "سماعة سوني WH-1000XM5", altEn: "Sony WH-1000XM5 headphones" }],
  faqCount: 3,
  schemaValid: true,
  duplicateTitleAr: false,
  duplicateTitleEn: false,
};
const status = (p: ScoreInput, lang: "ar" | "en", id: string) => seoChecks(p, lang).find((c) => c.id === id)?.status;

test("a complete product scores 100 with no problem", () => {
  const r = seoResult(full);
  assert.deepEqual([r.score, r.scoreAr, r.scoreEn, r.problems], [100, 100, 100, 0]);
});

test("an empty product scores low, and each problem says what to do", () => {
  const r = seoResult({ ...full, metaTitleAr: null, metaTitleEn: null, metaDescriptionAr: null, metaDescriptionEn: null, descriptionAr: "", descriptionEn: "", focusKeywordAr: null, focusKeywordEn: null, images: [], faqCount: 0, schemaValid: false });
  assert.ok(r.score < 10, String(r.score));
  assert.ok(r.checks.ar.every((c) => c.hint.length > 0));
});

test("the colour bands are exactly red 0-49, orange 50-79, green 80-100", () => {
  assert.deepEqual([0, 49, 50, 79, 80, 100].map(scoreTone), ["red", "red", "orange", "orange", "green", "green"]);
});

test("title length: empty and too long are bad, short is a warning", () => {
  assert.equal(status({ ...full, metaTitleAr: null }, "ar", "titleLength"), "bad");
  assert.equal(status({ ...full, metaTitleAr: "ا".repeat(61) }, "ar", "titleLength"), "bad");
  assert.equal(status({ ...full, metaTitleAr: "ا".repeat(60) }, "ar", "titleLength"), "good");
  assert.equal(status({ ...full, metaTitleAr: "ا".repeat(20) }, "ar", "titleLength"), "warn");
});

test("meta length limits", () => {
  assert.equal(status({ ...full, metaDescriptionEn: "a".repeat(156) }, "en", "metaLength"), "bad");
  assert.equal(status({ ...full, metaDescriptionEn: "a".repeat(155) }, "en", "metaLength"), "good");
  assert.equal(status({ ...full, metaDescriptionEn: "a".repeat(60) }, "en", "metaLength"), "warn");
});

test("Arabic keywords match across spelling variants and word order", () => {
  assert.equal(normalizeText("إِلْغاء الضوضاء"), "الغاء الضوضاء");
  assert.equal(containsKeyword("ساعة ذكية سامسونج", "سامسونج ساعه"), true);
  assert.equal(containsKeyword("شاحن أصلي", "شاحن اصلى"), true);
  assert.equal(containsKeyword("شاحن أصلي", "شاحن سريع"), false);
  assert.equal(containsKeyword("Sony WH-1000XM5", "sony wh 1000xm5"), true);
  assert.equal(containsKeyword("Sony", ""), false);
  assert.equal(containsKeyword(null, "x"), false);
});

test("no keyword fails every keyword check and asks for one", () => {
  const checks = seoChecks({ ...full, focusKeywordEn: " " }, "en").filter((c) => c.id.startsWith("keyword"));
  assert.equal(checks.length, 4);
  assert.ok(checks.every((c) => c.status === "bad" && c.hint.includes("الكلمة المفتاحية")));
});

test("the address check exists only in English, where it can pass", () => {
  assert.equal(status(full, "ar", "keywordSlug"), undefined);
  assert.equal(status(full, "en", "keywordSlug"), "good");
  assert.equal(status({ ...full, slug: "another-product" }, "en", "keywordSlug"), "bad");
});

test("each keyword place is checked on its own", () => {
  assert.equal(status({ ...full, metaTitleEn: "A very nice pair of headphones here" }, "en", "keywordTitle"), "bad");
  assert.equal(status({ ...full, metaDescriptionEn: "Something else entirely" }, "en", "keywordMeta"), "bad");
  assert.equal(status({ ...full, images: [{ altAr: "صورة", altEn: "photo" }] }, "en", "keywordAlt"), "bad");
});

test("description, alts, FAQ, schema and duplicates", () => {
  assert.equal(status({ ...full, descriptionAr: "ا".repeat(100) }, "ar", "descriptionLength"), "warn");
  assert.equal(status({ ...full, descriptionAr: "ا".repeat(20) }, "ar", "descriptionLength"), "bad");
  assert.equal(status({ ...full, images: [{ altAr: "", altEn: "x" }] }, "ar", "imageAlts"), "bad");
  assert.equal(status({ ...full, images: [{ altAr: "", altEn: "x" }] }, "en", "imageAlts"), "good");
  assert.equal(status({ ...full, faqCount: 2 }, "ar", "faqs"), "warn");
  assert.equal(status({ ...full, faqCount: 0 }, "ar", "faqs"), "bad");
  assert.equal(status({ ...full, schemaValid: false }, "ar", "schema"), "bad");
  assert.equal(status({ ...full, duplicateTitleEn: true }, "en", "uniqueTitle"), "bad");
  assert.equal(status({ ...full, duplicateTitleEn: true }, "ar", "uniqueTitle"), "good");
});

test("a warning earns half its weight", () => {
  assert.equal(languageScore([{ id: "a", label: "", hint: "", status: "warn", weight: 10 }, { id: "b", label: "", hint: "", status: "good", weight: 10 }]), 75);
});

test("a problem shared by both languages counts once", () => {
  assert.equal(seoResult({ ...full, schemaValid: false }).problems, 1);
  assert.equal(seoResult({ ...full, faqCount: 0 }).problems, 1);
  assert.equal(seoResult({ ...full, metaTitleAr: "ا".repeat(40), metaTitleEn: "a".repeat(40) }).problems, 2);
});

test("search previews cut long text like Google", () => {
  assert.equal(cutText("abc", 5), "abc");
  assert.equal(cutText("abcdefgh", 5), "abcd…");
});
