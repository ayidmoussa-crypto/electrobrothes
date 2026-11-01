import { slugify } from "@/lib/product-input";

// The SEO score, Yoast style: plain rules, no AI, so it is free and instant. Pure, so it can be tested.

export const MAX_TITLE = 60;
export const MIN_TITLE = 30;
export const MAX_META = 155;
export const MIN_META = 100;
export const MIN_DESCRIPTION = 150;
export const MIN_FAQS = 3;

export type SeoLang = "ar" | "en";
export type CheckStatus = "good" | "warn" | "bad";
export type SeoCheck = { id: string; label: string; status: CheckStatus; hint: string; weight: number };
export type ScoreTone = "red" | "orange" | "green";

/** The shop's colour bands: red 0-49, orange 50-79, green 80-100. */
export const scoreTone = (score: number): ScoreTone => (score >= 80 ? "green" : score >= 50 ? "orange" : "red");

export type ScoreInput = {
  slug: string;
  metaTitleAr: string | null;
  metaTitleEn: string | null;
  metaDescriptionAr: string | null;
  metaDescriptionEn: string | null;
  descriptionAr: string;
  descriptionEn: string;
  focusKeywordAr: string | null;
  focusKeywordEn: string | null;
  images: { altAr: string; altEn: string }[];
  faqCount: number;
  /** Everything the Product schema needs: an image, and a real price on every colour. */
  schemaValid: boolean;
  duplicateTitleAr: boolean;
  duplicateTitleEn: boolean;
};

/** Letters only, without what spelling varies on: hamza forms, ta marbuta, tashkeel, case. */
export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Every word of the keyword appears in the text, in any order. */
export function containsKeyword(text: string | null | undefined, keyword: string | null | undefined) {
  const words = normalizeText(keyword ?? "").split(" ").filter(Boolean);
  if (!words.length || !text) return false;
  const hay = normalizeText(text);
  return words.every((w) => hay.includes(w));
}

export function seoChecks(p: ScoreInput, lang: SeoLang): SeoCheck[] {
  const ar = lang === "ar";
  const title = (ar ? p.metaTitleAr : p.metaTitleEn)?.trim() ?? "";
  const meta = (ar ? p.metaDescriptionAr : p.metaDescriptionEn)?.trim() ?? "";
  const description = (ar ? p.descriptionAr : p.descriptionEn).trim();
  const keyword = (ar ? p.focusKeywordAr : p.focusKeywordEn)?.trim() ?? "";
  const alts = p.images.map((i) => (ar ? i.altAr : i.altEn).trim());
  const missingAlts = alts.filter((a) => !a).length;
  const duplicate = ar ? p.duplicateTitleAr : p.duplicateTitleEn;
  const needKeyword = "حدد الكلمة المفتاحية الفوق.";

  const check = (id: string, label: string, weight: number, status: CheckStatus, hint: string): SeoCheck => ({ id, label, weight, status, hint });
  const keywordCheck = (id: string, label: string, weight: number, found: boolean, hint: string) =>
    !keyword ? check(id, label, weight, "bad", needKeyword) : found ? check(id, label, weight, "good", "الكلمة المفتاحية كاينة.") : check(id, label, weight, "bad", hint);

  const list: SeoCheck[] = [
    !title
      ? check("titleLength", "طول العنوان", 15, "bad", "زيد عنوان SEO.")
      : title.length > MAX_TITLE
        ? check("titleLength", "طول العنوان", 15, "bad", `${title.length} حرف: Google غادي يقطعو. نقصو لـ ${MAX_TITLE} حرف.`)
        : title.length < MIN_TITLE
          ? check("titleLength", "طول العنوان", 15, "warn", `${title.length} حرف: قصير. زيد نوع المنتج ولا المغرب.`)
          : check("titleLength", "طول العنوان", 15, "good", `${title.length} حرف: مزيان.`),
    !meta
      ? check("metaLength", "طول meta", 15, "bad", "زيد meta description.")
      : meta.length > MAX_META
        ? check("metaLength", "طول meta", 15, "bad", `${meta.length} حرف: غادي يتقطع. نقصو لـ ${MAX_META} حرف.`)
        : meta.length < MIN_META
          ? check("metaLength", "طول meta", 15, "warn", `${meta.length} حرف: قصير. الأحسن من ${MIN_META} لـ ${MAX_META}.`)
          : check("metaLength", "طول meta", 15, "good", `${meta.length} حرف: مزيان.`),
    keywordCheck("keywordTitle", "الكلمة المفتاحية فالعنوان", 10, containsKeyword(title, keyword), "زيدها فعنوان SEO، الأحسن فالبداية."),
    keywordCheck("keywordMeta", "الكلمة المفتاحية فالوصف (meta)", 10, containsKeyword(meta, keyword), "زيدها فـ meta description."),
    // The address is Latin letters, so it can only carry the English keyword.
    ...(ar ? [] : [keywordCheck("keywordSlug", "الكلمة المفتاحية فالرابط", 5, slugify(keyword).split("-").every((w) => w && p.slug.includes(w)), "الرابط ما فيهش الكلمة المفتاحية.")]),
    keywordCheck("keywordAlt", "الكلمة المفتاحية فـ alt", 5, alts.some((a) => containsKeyword(a, keyword)), "زيدها فنص alt ديال صورة وحدة على الأقل."),
    description.length >= MIN_DESCRIPTION
      ? check("descriptionLength", "طول الوصف", 15, "good", `${description.length} حرف: مزيان.`)
      : description.length >= 80
        ? check("descriptionLength", "طول الوصف", 15, "warn", `${description.length} حرف: زيد حتى ${MIN_DESCRIPTION} على الأقل.`)
        : check("descriptionLength", "طول الوصف", 15, "bad", `${description.length} حرف: قصير بزاف. كتب ${MIN_DESCRIPTION} حرف على الأقل.`),
    !p.images.length
      ? check("imageAlts", "صور بلا alt", 5, "bad", "المنتج ما عندوش صور.")
      : missingAlts
        ? check("imageAlts", "صور بلا alt", 5, "bad", `${missingAlts} من ${alts.length} صور بلا alt.`)
        : check("imageAlts", "صور بلا alt", 5, "good", "كل الصور عندها alt."),
    p.faqCount >= MIN_FAQS
      ? check("faqs", "الأسئلة الشائعة", 5, "good", `${p.faqCount} أسئلة.`)
      : p.faqCount
        ? check("faqs", "الأسئلة الشائعة", 5, "warn", `${p.faqCount} فقط: الأحسن ${MIN_FAQS} على الأقل.`)
        : check("faqs", "الأسئلة الشائعة", 5, "bad", `زيد ${MIN_FAQS} أسئلة على الأقل.`),
    p.schemaValid ? check("schema", "Product schema", 10, "good", "البيانات اللي كيحتاجها Google كاملة.") : check("schema", "Product schema", 10, "bad", "خاص صورة وثمن لكل لون."),
    duplicate ? check("uniqueTitle", "عنوان ما مكررش", 5, "bad", "نفس العنوان كاين فمنتج آخر: بدلو.") : check("uniqueTitle", "عنوان ما مكررش", 5, "good", "العنوان فريد."),
  ];
  return list;
}

/** Out of 100: a warning earns half its weight. */
export function languageScore(checks: SeoCheck[]) {
  const total = checks.reduce((n, c) => n + c.weight, 0);
  const earned = checks.reduce((n, c) => n + (c.status === "good" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
  return total ? Math.round((earned / total) * 100) : 0;
}

/** Checks that do not depend on the language count once as a problem. */
const SHARED = new Set(["schema", "faqs"]);

export function seoResult(p: ScoreInput) {
  const ar = seoChecks(p, "ar");
  const en = seoChecks(p, "en");
  const scoreAr = languageScore(ar);
  const scoreEn = languageScore(en);
  const problems = ar.filter((c) => c.status !== "good").length + en.filter((c) => c.status !== "good" && !SHARED.has(c.id)).length;
  return { score: Math.round((scoreAr + scoreEn) / 2), scoreAr, scoreEn, problems, checks: { ar, en } };
}

/** What a search result would show, cut where Google usually cuts. */
export const cutText = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
