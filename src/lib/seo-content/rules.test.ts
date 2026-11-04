import assert from "node:assert/strict";
import { test } from "node:test";
import { missingPagePath, movedProductPath } from "./slug";
import { canonical, fieldLabel, fieldValue, isCleanSlug, NEEDS_CHECK_AR, needsApproval, previewValue, shareImageUrl, toSuggestionRows, unbackedClaim, type ClaimFacts, type GeneratedContent, type ProductContent } from "./rules";

const product: ProductContent = {
  slug: "sony-wh-1000xm5",
  metaTitleAr: null,
  metaTitleEn: null,
  metaDescriptionAr: null,
  metaDescriptionEn: null,
  focusKeywordAr: null,
  focusKeywordEn: null,
  descriptionAr: "وصف قديم قصير",
  descriptionEn: "Old short text",
  highlightsAr: [],
  highlightsEn: [],
  categoryId: "c1",
  brandId: "b1",
  images: [{ url: "https://res.cloudinary.com/x/image/upload/a.jpg", altAr: "", altEn: "" }],
  specs: [{ key: "anc", valueAr: "نعم", valueEn: "Yes", numericValue: null }],
  faqs: [],
};
const generated: GeneratedContent = {
  description_ar: "وصف جديد واضح للمنتج",
  description_en: "A clear new description",
  highlights_ar: ["نقطة"],
  highlights_en: ["Point"],
  specs: [],
  meta_title_ar: "سوني WH-1000XM5 ثمن المغرب",
  meta_title_en: "Sony WH-1000XM5 price Morocco",
  meta_description_ar: "سماعات سوني في المغرب مع الدفع عند الاستلام والتوصيل لكل المدن",
  meta_description_en: "Sony headphones in Morocco with cash on delivery to every city",
  focus_keyword_ar: "سماعة سوني",
  focus_keyword_en: "Sony headphones",
  slug: "sony-wh-1000xm5",
  image_alts: [],
  faqs: [],
  category_id: null,
  brand_id: null,
};
const known = { categories: new Set(["c1", "c2"]), brands: new Set(["b1"]) };
const facts: ClaimFacts = {
  warrantyMonths: 12,
  deliveryTime: ["2 إلى 5 أيام", "2 to 5 days"],
  replacementPolicy: ["إلا وصلك المنتج فيه عطب، كنبدلوه ليك بمنتج جديد.", "If your product arrives defective, we replace it with a new one."],
  productText: "Sony WH-1000XM5 سوني battery 30 h",
  shopNumbers: [20, 30, 500],
};
const fields = (g: Partial<GeneratedContent>, p = product, f = facts) => toSuggestionRows({ ...generated, ...g }, p, known, f);

test("the approved wordings from the settings pass", () => {
  for (const t of ["التوصيل خلال 2 إلى 5 أيام.", "Delivery takes 2 to 5 days.", "إلا وصلك المنتج فيه عطب، كنبدلوه ليك بمنتج جديد.", "If your product arrives defective, we replace it with a new one.", "ما هي سياسة الاستبدال؟", "What is the replacement policy?", "ضمان 12 شهرا", "12-month warranty", "Sony WH-1000XM5 with a 30 h battery", "رسوم التوصيل من 20 إلى 30 درهما، ومجاني من 500 درهم"]) {
    assert.equal(unbackedClaim(t, facts), null, t);
  }
});

test("a delivery time that is not the setting's is refused", () => {
  for (const t of ["التوصيل خلال 1 إلى 3 أيام", "Delivery takes 1 to 3 days", "1-3 day delivery", "توصيل خلال يومين", "delivered tomorrow", "التوصيل خلال ٣ أيام", "Delivery in 2 to 4 days"]) {
    assert.ok(unbackedClaim(t, facts), t);
  }
});

test("any return or refund wording is refused, and replacement only as the setting says it", () => {
  for (const t of ["يمكنك إرجاع المنتج خلال 7 أيام", "Returns accepted", "You can return it", "full refund", "money back guarantee", "استرجاع الفلوس", "نستبدل المنتج مجانا عبر استبدال سريع", "free exchange", "we replace it within a week"]) {
    assert.ok(unbackedClaim(t, facts), t);
  }
});

test("a warranty must match the product's field; an empty field allows no mention", () => {
  for (const t of ["ضمان 24 شهرا", "24-month warranty", "ضمان سنتين", "2 years warranty", "warranty of 1 year"]) assert.ok(unbackedClaim(t, facts), t);
  const none = { ...facts, warrantyMonths: null };
  for (const t of ["ضمان رسمي", "official warranty", "guaranteed", "ضمان 12 شهرا", "12-month warranty"]) assert.ok(unbackedClaim(t, none), t);
  assert.equal(unbackedClaim("ضمان 24 شهرا", { ...facts, warrantyMonths: 24 }), null);
});

test("a number with no source is refused, in either digit style", () => {
  for (const t of ["بطارية 40 ساعة", "Bluetooth 5.2", "٤٠ ساعة", "only 299 MAD", "خصم 10%"]) assert.ok(unbackedClaim(t, facts), t);
  assert.equal(unbackedClaim("بطارية ٣٠ ساعة", facts), null);
});

test("a description with an unbacked promise is dropped and reported", () => {
  const { rows, dropped } = fields({ description_ar: "سماعات ممتازة مع إمكانية الإرجاع خلال 7 أيام", meta_description_en: "Sony headphones in Morocco, delivered in 1 to 3 days with cash on delivery" });
  assert.ok(!rows.some((r) => r.field === "descriptionAr" || r.field === "metaDescriptionEn"));
  assert.equal(dropped.length, 2);
});

test("one bad FAQ or highlight is dropped, the good ones stay", () => {
  const ok = { question_ar: "كيف أدفع؟", answer_ar: "عند الاستلام", question_en: "How do I pay?", answer_en: "On delivery" };
  const bad = { question_ar: "هل يمكن الإرجاع؟", answer_ar: "نعم خلال 7 أيام", question_en: "Returns?", answer_en: "Within 7 days" };
  const { rows } = fields({ faqs: [ok, bad, ok, ok], highlights_ar: ["صوت قوي", "ضمان 24 شهرا"] });
  assert.equal((rows.find((r) => r.field === "faqs")?.newValue as unknown[]).length, 3);
  assert.deepEqual(rows.find((r) => r.field === "highlightsAr")?.newValue, ["صوت قوي"]);
});

test("too-long titles and descriptions are dropped and reported, never cut", () => {
  const { rows, dropped } = fields({ meta_title_ar: "ا".repeat(61), meta_description_en: "a".repeat(156) });
  assert.ok(!rows.some((r) => r.field === "metaTitleAr" || r.field === "metaDescriptionEn"));
  assert.equal(dropped.length, 2);
});

test("exactly the limit is accepted", () => {
  const { rows } = fields({ meta_title_ar: "ا".repeat(60), meta_description_en: "a".repeat(155) });
  assert.ok(rows.some((r) => r.field === "metaTitleAr") && rows.some((r) => r.field === "metaDescriptionEn"));
});

test("an uncertain specification says needs checking", () => {
  const { rows } = fields({ specs: [{ key: "battery", value_ar: "30 ساعة", value_en: "30 hours", numeric_value: 30, certain: false }] });
  const spec = rows.find((r) => r.field === "spec:battery")!;
  assert.equal(spec.needsCheck, true);
  assert.equal((spec.newValue as { valueAr: string }).valueAr, NEEDS_CHECK_AR);
});

test("an uncertain specification never replaces a known value", () => {
  const { rows } = fields({ specs: [{ key: "anc", value_ar: "لا", value_en: "No", numeric_value: null, certain: false }] });
  assert.ok(!rows.some((r) => r.field === "spec:anc"));
});

test("a live clean address is never moved; only a messy one", () => {
  assert.ok(!fields({ slug: "another-name" }).rows.some((r) => r.field === "slug"));
  const messy = fields({ slug: "Sony WH 1000XM5" }, { ...product, slug: "Sony_XM5!" }).rows.find((r) => r.field === "slug");
  assert.equal(messy?.newValue, "sony-wh-1000xm5");
});

test("unchanged values produce no suggestion", () => {
  const same = { ...product, descriptionAr: generated.description_ar };
  assert.ok(!fields({}, same).rows.some((r) => r.field === "descriptionAr"));
});

test("fewer than 3 FAQs and at most 5 are respected", () => {
  const faq = { question_ar: "س", answer_ar: "ج", question_en: "Q", answer_en: "A" };
  assert.ok(!fields({ faqs: [faq, faq] }).rows.some((r) => r.field === "faqs"));
  const six = fields({ faqs: Array(6).fill(faq) }).rows.find((r) => r.field === "faqs");
  assert.equal((six?.newValue as unknown[]).length, 5);
});

test("a category or brand must exist, and must differ", () => {
  assert.ok(!fields({ category_id: "invented" }).rows.some((r) => r.field === "categoryId"));
  assert.ok(!fields({ category_id: "c1" }).rows.some((r) => r.field === "categoryId"));
  assert.ok(fields({ category_id: "c2" }).rows.some((r) => r.field === "categoryId"));
});

test("image alts attach to the right image by address", () => {
  const url = product.images[0].url;
  const { rows } = fields({ image_alts: [{ index: 0, alt_ar: "سماعة", alt_en: "Headphones" }, { index: 9, alt_ar: "x", alt_en: "x" }] });
  assert.ok(rows.some((r) => r.field === `altAr:${url}`) && rows.some((r) => r.field === `altEn:${url}`));
  assert.equal(rows.filter((r) => r.field.startsWith("alt")).length, 2);
  assert.equal(fieldValue(product, `altEn:${url}`), "");
  assert.ok(fieldLabel(`altAr:${url}`).endsWith("a.jpg"));
});

test("content goes live by itself; numbers, doubts, category, brand and address wait", () => {
  for (const f of ["descriptionAr", "descriptionEn", "highlightsAr", "metaTitleAr", "metaTitleEn", "metaDescriptionAr", "metaDescriptionEn", "altAr:/a.jpg", "altEn:https://x/a.jpg", "faqs"]) assert.equal(needsApproval(f, "x", false), false, f);
  for (const f of ["categoryId", "brandId", "slug"]) assert.equal(needsApproval(f, "x", false), true, f);
  const spec = (valueAr: string, valueEn: string, numericValue: number | null = null) => ({ key: "k", valueAr, valueEn, numericValue });
  assert.equal(needsApproval("spec:anc", spec("نعم", "Yes"), false), false);
  assert.equal(needsApproval("spec:battery", spec("30 ساعة", "30 hours"), false), true);
  assert.equal(needsApproval("spec:battery", spec("٣٠ ساعة", "long"), false), true);
  assert.equal(needsApproval("spec:water", spec("مقاوم", "IP67"), false), true);
  assert.equal(needsApproval("spec:ram", spec("كبيرة", "large", 8), false), true);
  assert.equal(needsApproval("spec:anc", spec(NEEDS_CHECK_AR, "Needs checking"), true), true);
});

test("the compact table shows one short line per value", () => {
  assert.equal(previewValue("faqs", [{}, {}, {}]), "3 أسئلة");
  assert.equal(previewValue("highlightsAr", ["أ", "ب"]), "أ · ب");
  assert.equal(previewValue("categoryId", "c1", { c1: "سماعات" }), "سماعات");
});

test("values compare equal whatever the key order the database returns", () => {
  assert.equal(canonical({ a: 1, b: [{ c: 2, d: null }] }), canonical({ b: [{ d: null, c: 2 }], a: 1 }));
  assert.notEqual(canonical({ a: 1 }), canonical({ a: 2 }));
});

test("a moved product keeps the visitor's language", () => {
  assert.equal(movedProductPath("", "sony-xm5"), "/products/sony-xm5");
  assert.equal(movedProductPath("/en", "sony-xm5"), "/en/products/sony-xm5");
});

test("a missing page's 404 keeps the visitor's language", () => {
  assert.equal(missingPagePath(""), "/ar/missing-page");
  assert.equal(missingPagePath("/en"), "/en/missing-page");
});

test("clean slugs", () => {
  assert.equal(isCleanSlug("sony-wh-1000xm5"), true);
  for (const s of ["Sony", "a--b", "-a", "a_b", "سوني", "a".repeat(81)]) assert.equal(isCleanSlug(s), false);
});

test("share images are JPEG-sized on Cloudinary, and SVG has none", () => {
  assert.equal(shareImageUrl("/placeholders/a.svg"), null);
  assert.equal(shareImageUrl(undefined), null);
  assert.equal(shareImageUrl("/a.jpg"), "/a.jpg");
  assert.ok(shareImageUrl("https://res.cloudinary.com/x/image/upload/a.webp")!.includes("/upload/c_pad,w_1200,h_630,b_white,f_jpg/"));
});
