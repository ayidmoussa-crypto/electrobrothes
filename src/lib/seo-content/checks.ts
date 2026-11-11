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

export function seoChecks(p: ScoreInput, lang: SeoLang, ui: "ar" | "en" = "ar"): SeoCheck[] {
  const ar = lang === "ar";
  // `lang` is the content checked; `ui` is the language the owner reads the checks in.
  const t = (arText: string, enText: string) => (ui === "en" ? enText : arText);
  const title = (ar ? p.metaTitleAr : p.metaTitleEn)?.trim() ?? "";
  const meta = (ar ? p.metaDescriptionAr : p.metaDescriptionEn)?.trim() ?? "";
  const description = (ar ? p.descriptionAr : p.descriptionEn).trim();
  const keyword = (ar ? p.focusKeywordAr : p.focusKeywordEn)?.trim() ?? "";
  const alts = p.images.map((i) => (ar ? i.altAr : i.altEn).trim());
  const missingAlts = alts.filter((a) => !a).length;
  const duplicate = ar ? p.duplicateTitleAr : p.duplicateTitleEn;
  const needKeyword = t("حدد الكلمة المفتاحية الفوق.", "Set the focus keyword above.");

  const check = (id: string, label: string, weight: number, status: CheckStatus, hint: string): SeoCheck => ({ id, label, weight, status, hint });
  const keywordCheck = (id: string, label: string, weight: number, found: boolean, hint: string) =>
    !keyword ? check(id, label, weight, "bad", needKeyword) : found ? check(id, label, weight, "good", t("الكلمة المفتاحية كاينة.", "The keyword is there.")) : check(id, label, weight, "bad", hint);
  const titleLabel = t("طول العنوان", "Title length");
  const metaLabel = t("طول meta", "Meta length");
  const descLabel = t("طول الوصف", "Description length");
  const altLabel = t("صور بلا alt", "Images without alt");
  const faqLabel = t("الأسئلة الشائعة", "FAQs");
  const uniqueLabel = t("عنوان ما مكررش", "Unique title");
  const chars = (n: number) => t(`${n} حرف`, `${n} characters`);

  const list: SeoCheck[] = [
    !title
      ? check("titleLength", titleLabel, 15, "bad", t("زيد عنوان SEO.", "Add an SEO title."))
      : title.length > MAX_TITLE
        ? check("titleLength", titleLabel, 15, "bad", `${chars(title.length)}: ${t(`Google غادي يقطعو. نقصو لـ ${MAX_TITLE} حرف.`, `Google will cut it. Bring it down to ${MAX_TITLE}.`)}`)
        : title.length < MIN_TITLE
          ? check("titleLength", titleLabel, 15, "warn", `${chars(title.length)}: ${t("قصير. زيد نوع المنتج ولا المغرب.", "short. Add the product type or Morocco.")}`)
          : check("titleLength", titleLabel, 15, "good", `${chars(title.length)}: ${t("مزيان.", "good.")}`),
    !meta
      ? check("metaLength", metaLabel, 15, "bad", t("زيد meta description.", "Add a meta description."))
      : meta.length > MAX_META
        ? check("metaLength", metaLabel, 15, "bad", `${chars(meta.length)}: ${t(`غادي يتقطع. نقصو لـ ${MAX_META} حرف.`, `it will be cut. Bring it down to ${MAX_META}.`)}`)
        : meta.length < MIN_META
          ? check("metaLength", metaLabel, 15, "warn", `${chars(meta.length)}: ${t(`قصير. الأحسن من ${MIN_META} لـ ${MAX_META}.`, `short. Best between ${MIN_META} and ${MAX_META}.`)}`)
          : check("metaLength", metaLabel, 15, "good", `${chars(meta.length)}: ${t("مزيان.", "good.")}`),
    keywordCheck("keywordTitle", t("الكلمة المفتاحية فالعنوان", "Keyword in the title"), 10, containsKeyword(title, keyword), t("زيدها فعنوان SEO، الأحسن فالبداية.", "Add it to the SEO title, best at the start.")),
    keywordCheck("keywordMeta", t("الكلمة المفتاحية فالوصف (meta)", "Keyword in the meta description"), 10, containsKeyword(meta, keyword), t("زيدها فـ meta description.", "Add it to the meta description.")),
    // The address is Latin letters, so it can only carry the English keyword.
    ...(ar
      ? []
      : [keywordCheck("keywordSlug", t("الكلمة المفتاحية فالرابط", "Keyword in the link"), 5, slugify(keyword).split("-").every((w) => w && p.slug.includes(w)), t("الرابط ما فيهش الكلمة المفتاحية.", "The link does not hold the keyword."))]),
    keywordCheck("keywordAlt", t("الكلمة المفتاحية فـ alt", "Keyword in alt"), 5, alts.some((a) => containsKeyword(a, keyword)), t("زيدها فنص alt ديال صورة وحدة على الأقل.", "Add it to the alt text of at least one image.")),
    description.length >= MIN_DESCRIPTION
      ? check("descriptionLength", descLabel, 15, "good", `${chars(description.length)}: ${t("مزيان.", "good.")}`)
      : description.length >= 80
        ? check("descriptionLength", descLabel, 15, "warn", `${chars(description.length)}: ${t(`زيد حتى ${MIN_DESCRIPTION} على الأقل.`, `add up to ${MIN_DESCRIPTION} at least.`)}`)
        : check("descriptionLength", descLabel, 15, "bad", `${chars(description.length)}: ${t(`قصير بزاف. كتب ${MIN_DESCRIPTION} حرف على الأقل.`, `far too short. Write ${MIN_DESCRIPTION} characters at least.`)}`),
    !p.images.length
      ? check("imageAlts", altLabel, 5, "bad", t("المنتج ما عندوش صور.", "The product has no images."))
      : missingAlts
        ? check("imageAlts", altLabel, 5, "bad", t(`${missingAlts} من ${alts.length} صور بلا alt.`, `${missingAlts} of ${alts.length} images have no alt.`))
        : check("imageAlts", altLabel, 5, "good", t("كل الصور عندها alt.", "Every image has alt text.")),
    p.faqCount >= MIN_FAQS
      ? check("faqs", faqLabel, 5, "good", t(`${p.faqCount} أسئلة.`, `${p.faqCount} questions.`))
      : p.faqCount
        ? check("faqs", faqLabel, 5, "warn", t(`${p.faqCount} فقط: الأحسن ${MIN_FAQS} على الأقل.`, `Only ${p.faqCount}: best ${MIN_FAQS} at least.`))
        : check("faqs", faqLabel, 5, "bad", t(`زيد ${MIN_FAQS} أسئلة على الأقل.`, `Add ${MIN_FAQS} questions at least.`)),
    p.schemaValid
      ? check("schema", "Product schema", 10, "good", t("البيانات اللي كيحتاجها Google كاملة.", "The data Google needs is complete."))
      : check("schema", "Product schema", 10, "bad", t("خاص صورة وثمن لكل لون.", "Each colour needs an image and a price.")),
    duplicate
      ? check("uniqueTitle", uniqueLabel, 5, "bad", t("نفس العنوان كاين فمنتج آخر: بدلو.", "Another product has the same title: change it."))
      : check("uniqueTitle", uniqueLabel, 5, "good", t("العنوان فريد.", "The title is unique.")),
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

export function seoResult(p: ScoreInput, ui: "ar" | "en" = "ar") {
  const ar = seoChecks(p, "ar", ui);
  const en = seoChecks(p, "en", ui);
  const scoreAr = languageScore(ar);
  const scoreEn = languageScore(en);
  const problems = ar.filter((c) => c.status !== "good").length + en.filter((c) => c.status !== "good" && !SHARED.has(c.id)).length;
  return { score: Math.round((scoreAr + scoreEn) / 2), scoreAr, scoreEn, problems, checks: { ar, en } };
}

/** What a search result would show, cut where Google usually cuts. */
export const cutText = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
