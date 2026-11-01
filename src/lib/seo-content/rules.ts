import { slugify } from "@/lib/product-input";
import { isCleanSlug } from "./slug";

// Pure rules of product content and SEO (no database, no network), so they can be tested directly.

export const MAX_META_TITLE = 60;
export const MAX_META_DESCRIPTION = 155;
export const WEAK_SCORE = 60;
export const NEEDS_CHECK_AR = "خاص التحقق";
export const NEEDS_CHECK_EN = "Needs checking";

export type Faq = { questionAr: string; answerAr: string; questionEn: string; answerEn: string };
export type SpecValue = { key: string; valueAr: string; valueEn: string; numericValue: number | null };
export type ProductContent = {
  slug: string;
  metaTitleAr: string | null;
  metaTitleEn: string | null;
  metaDescriptionAr: string | null;
  metaDescriptionEn: string | null;
  focusKeywordAr: string | null;
  focusKeywordEn: string | null;
  descriptionAr: string;
  descriptionEn: string;
  highlightsAr: string[];
  highlightsEn: string[];
  categoryId: string;
  brandId: string;
  images: { url: string; altAr: string; altEn: string }[];
  specs: SpecValue[];
  faqs: Faq[];
};

export { isCleanSlug };

// ───────── Fields ─────────

const TEXT_FIELDS = ["metaTitleAr", "metaTitleEn", "metaDescriptionAr", "metaDescriptionEn", "focusKeywordAr", "focusKeywordEn", "descriptionAr", "descriptionEn", "slug", "categoryId", "brandId"] as const;
const LIST_FIELDS = ["highlightsAr", "highlightsEn"] as const;
const LABELS: Record<string, string> = {
  metaTitleAr: "عنوان SEO بالعربية",
  metaTitleEn: "عنوان SEO بالإنجليزية",
  metaDescriptionAr: "Meta description بالعربية",
  metaDescriptionEn: "Meta description بالإنجليزية",
  focusKeywordAr: "الكلمة المفتاحية بالعربية",
  focusKeywordEn: "الكلمة المفتاحية بالإنجليزية",
  descriptionAr: "الوصف بالعربية",
  descriptionEn: "الوصف بالإنجليزية",
  highlightsAr: "نقاط المميزات بالعربية",
  highlightsEn: "نقاط المميزات بالإنجليزية",
  slug: "الرابط (slug)",
  categoryId: "القسم",
  brandId: "الماركة",
  faqs: "الأسئلة الشائعة",
};

export function fieldLabel(field: string) {
  const [kind, rest] = splitField(field);
  if (kind === "spec") return `المواصفة: ${rest}`;
  if (kind === "altAr" || kind === "altEn") return `alt ${kind === "altAr" ? "بالعربية" : "بالإنجليزية"}: ${rest.split("/").pop()}`;
  return LABELS[field] ?? field;
}

/** "altAr:/a.jpg" → ["altAr", "/a.jpg"]. Only the first colon splits: image URLs contain colons. */
const splitField = (field: string): [string, string] => {
  const i = field.indexOf(":");
  return i < 0 ? [field, ""] : [field.slice(0, i), field.slice(i + 1)];
};
export const parseField = splitField;

/**
 * What waits for the owner: unconfirmed values, specifications containing numbers, the category, the
 * brand, and the address. Everything else goes live by itself, with an undo button.
 */
export function needsApproval(field: string, newValue: unknown, needsCheck: boolean) {
  if (needsCheck) return true;
  const [kind] = splitField(field);
  if (kind === "categoryId" || kind === "brandId" || kind === "slug") return true;
  if (kind === "spec") {
    const spec = newValue as SpecValue;
    return spec.numericValue !== null || /\p{Nd}/u.test(`${spec.valueAr} ${spec.valueEn}`);
  }
  return false;
}

/** The current value of a field; null when there is none. */
export function fieldValue(p: ProductContent, field: string): unknown {
  const [kind, rest] = splitField(field);
  if ((TEXT_FIELDS as readonly string[]).includes(kind)) return p[kind as (typeof TEXT_FIELDS)[number]] ?? null;
  if ((LIST_FIELDS as readonly string[]).includes(kind)) return p[kind as (typeof LIST_FIELDS)[number]];
  if (kind === "faqs") return p.faqs;
  if (kind === "spec") return p.specs.find((s) => s.key === rest) ?? null;
  if (kind === "altAr" || kind === "altEn") {
    const image = p.images.find((i) => i.url === rest);
    return image ? (kind === "altAr" ? image.altAr : image.altEn) : null;
  }
  return null;
}

/** Comparable text of any JSON value: the database does not keep key order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** A field's value as lines for the old/new comparison. */
export function describeValue(field: string, value: unknown, names: Record<string, string> = {}): string[] {
  if (value === null || value === undefined || value === "") return [];
  const [kind] = splitField(field);
  if (kind === "faqs") return (value as Faq[]).flatMap((f) => [`س: ${f.questionAr}`, `ج: ${f.answerAr}`, `Q: ${f.questionEn}`, `A: ${f.answerEn}`]);
  if (kind === "spec") {
    const s = value as SpecValue;
    return s.valueAr === s.valueEn ? [s.valueAr] : [s.valueAr, s.valueEn];
  }
  if (Array.isArray(value)) return value.map(String);
  if (kind === "categoryId" || kind === "brandId") return [names[String(value)] ?? String(value)];
  return [String(value)];
}

/** One short line for the compact table. */
export function previewValue(field: string, value: unknown, names: Record<string, string> = {}) {
  if (splitField(field)[0] === "faqs") return `${(value as Faq[]).length} أسئلة`;
  return describeValue(field, value, names).join(" · ");
}

// ───────── Promises and numbers must come from the shop's data ─────────

export type ClaimFacts = {
  /** null when the product's warranty field is empty. */
  warrantyMonths: number | null;
  /** Word-for-word texts from the settings, in both languages. */
  deliveryTime: string[];
  replacementPolicy: string[];
  /** Names, brand, specifications: any number in here is backed by the catalog. */
  productText: string;
  /** Delivery fees and the free-delivery threshold. */
  shopNumbers: number[];
};

const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const numbersIn = (s: string) => westernDigits(s).match(/\d+/g) ?? [];

/**
 * Why a generated text cannot go live, or null when it is fine. The prompt asks for the same thing;
 * this is what makes it a rule: a promise or number with no source never reaches the store.
 */
export function unbackedClaim(text: string, facts: ClaimFacts) {
  let rest = westernDigits(text);
  // The approved wordings are fine exactly as written; only what is left is examined.
  for (const approved of [...facts.deliveryTime, ...facts.replacementPolicy]) rest = rest.split(westernDigits(approved)).join(" ");
  rest = rest.replace(/سياسة الاستبدال|replacement policy/gi, " ");

  if (/إرجاع|ارجاع|استرجاع|استرداد|ترجيع|refund|money.?back|\breturn(s|ed|able)?\b/i.test(rest)) return "وعد بالإرجاع ولا استرجاع الفلوس";
  if (/استبدال|تبديل|كنبدلوه|exchange|replac/i.test(rest)) return "وعد بالاستبدال بصياغة ماشي ديال الإعدادات";
  if (/ضمان|مضمون|warrant|guarantee/i.test(rest)) {
    if (facts.warrantyMonths === null) return "ذكر الضمان وخانة الضمان خاوية";
    if (/(ضمان|مضمون|warrant|guarantee).{0,30}(سنة|سنتين|years?\b)|(سنة|سنتين|years?\b).{0,30}(ضمان|warrant|guarantee)/i.test(rest)) return "مدة ضمان ماشي ديال الخانة";
  }
  for (const m of rest.matchAll(/(\d+)[\s-]*(?:شهر|أشهر|اشهر|months?\b)/gi)) {
    if (Number(m[1]) !== facts.warrantyMonths) return `مدة ${m[1]} شهر ماشي ديال خانة الضمان`;
  }
  if (/\d+[\s-]*(?:يوم|أيام|ايام|days?\b)|(?:توصيل|delivery|delivered|ship).{0,25}(?:يوم|يومين|أيام|ساعة|hours?\b|days?\b|tomorrow|غدا)/i.test(rest)) return "مدة توصيل ماشي ديال الإعدادات";

  const allowed = new Set([...numbersIn(facts.productText), ...facts.shopNumbers.map(String), ...(facts.warrantyMonths === null ? [] : [String(facts.warrantyMonths)])]);
  const unknown = numbersIn(rest).find((n) => !allowed.has(n));
  return unknown ? `الرقم ${unknown} ما كاينش فبيانات المنتج ولا الإعدادات` : null;
}

// ───────── From Claude's answer to suggestions ─────────

export type GeneratedContent = {
  description_ar: string;
  description_en: string;
  highlights_ar: string[];
  highlights_en: string[];
  specs: { key: string; value_ar: string; value_en: string; numeric_value: number | null; certain: boolean }[];
  meta_title_ar: string;
  meta_title_en: string;
  meta_description_ar: string;
  meta_description_en: string;
  focus_keyword_ar: string;
  focus_keyword_en: string;
  slug: string;
  image_alts: { index: number; alt_ar: string; alt_en: string }[];
  faqs: { question_ar: string; answer_ar: string; question_en: string; answer_en: string }[];
  category_id: string | null;
  brand_id: string | null;
};

export type SuggestionRow = { field: string; oldValue: unknown; newValue: unknown; needsCheck: boolean };

/**
 * Turns Claude's answer into one row per field. Keeps only real changes that respect the limits:
 * too-long search texts and texts with an unbacked promise or number are dropped (and reported), never
 * cut mid-word, and an uncertain specification can never overwrite a value already in the catalog.
 */
export function toSuggestionRows(gen: GeneratedContent, current: ProductContent, known: { categories: Set<string>; brands: Set<string> }, facts: ClaimFacts) {
  const rows: SuggestionRow[] = [];
  const dropped: string[] = [];
  const add = (field: string, newValue: unknown, needsCheck = false) => {
    const oldValue = fieldValue(current, field);
    if (canonical(oldValue) !== canonical(newValue)) rows.push({ field, oldValue, newValue, needsCheck });
  };
  const backed = (label: string, value: string) => {
    const why = unbackedClaim(value, facts);
    if (why) dropped.push(`${label}: ${why}`);
    return !why;
  };
  const text = (field: string, value: string, min: number, max: number) => {
    const clean = value.trim();
    if (clean.length < min || clean.length > max) dropped.push(`${fieldLabel(field)}: ${clean.length} حرف`);
    else if (backed(fieldLabel(field), clean)) add(field, clean);
  };

  text("descriptionAr", gen.description_ar, 10, 5000);
  text("descriptionEn", gen.description_en, 10, 5000);
  text("metaTitleAr", gen.meta_title_ar, 10, MAX_META_TITLE);
  text("metaTitleEn", gen.meta_title_en, 10, MAX_META_TITLE);
  text("metaDescriptionAr", gen.meta_description_ar, 30, MAX_META_DESCRIPTION);
  text("metaDescriptionEn", gen.meta_description_en, 30, MAX_META_DESCRIPTION);
  text("focusKeywordAr", gen.focus_keyword_ar, 2, 80);
  text("focusKeywordEn", gen.focus_keyword_en, 2, 80);

  for (const [field, list] of [["highlightsAr", gen.highlights_ar], ["highlightsEn", gen.highlights_en]] as const) {
    const clean = list.map((h) => h.trim()).filter((h) => h && backed(fieldLabel(field), h)).slice(0, 8);
    if (clean.length) add(field, clean);
  }

  // A live address only moves when it is not clean: a changed URL costs search ranking.
  const slug = slugify(gen.slug);
  if (!isCleanSlug(current.slug) && isCleanSlug(slug)) add("slug", slug);

  for (const s of gen.specs) {
    const key = s.key.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(key) || key.length > 30) continue;
    const existing = current.specs.find((e) => e.key === key);
    if (!s.certain) {
      if (!existing) add(`spec:${key}`, { key, valueAr: NEEDS_CHECK_AR, valueEn: NEEDS_CHECK_EN, numericValue: null }, true);
      continue;
    }
    if (s.value_ar.trim() && s.value_en.trim()) add(`spec:${key}`, { key, valueAr: s.value_ar.trim(), valueEn: s.value_en.trim(), numericValue: s.numeric_value });
  }

  for (const alt of gen.image_alts) {
    const image = current.images[alt.index];
    if (!image) continue;
    if (alt.alt_ar.trim() && backed(fieldLabel(`altAr:${image.url}`), alt.alt_ar)) add(`altAr:${image.url}`, alt.alt_ar.trim().slice(0, 200));
    if (alt.alt_en.trim() && backed(fieldLabel(`altEn:${image.url}`), alt.alt_en)) add(`altEn:${image.url}`, alt.alt_en.trim().slice(0, 200));
  }

  const faqs = gen.faqs
    .map((f) => ({ questionAr: f.question_ar.trim(), answerAr: f.answer_ar.trim(), questionEn: f.question_en.trim(), answerEn: f.answer_en.trim() }))
    .filter((f) => f.questionAr && f.answerAr && f.questionEn && f.answerEn && backed(LABELS.faqs, `${f.questionAr} ${f.answerAr} ${f.questionEn} ${f.answerEn}`))
    .slice(0, 5);
  if (faqs.length >= 3) add("faqs", faqs);

  if (gen.category_id && known.categories.has(gen.category_id)) add("categoryId", gen.category_id);
  if (gen.brand_id && known.brands.has(gen.brand_id)) add("brandId", gen.brand_id);

  return { rows, dropped };
}

/** Facebook and WhatsApp previews: a JPEG sized for sharing. SVG cannot be previewed at all. */
export function shareImageUrl(url: string | undefined) {
  if (!url || url.toLowerCase().endsWith(".svg")) return null;
  if (url.startsWith("https://res.cloudinary.com/") && url.includes("/upload/")) return url.replace("/upload/", "/upload/c_pad,w_1200,h_630,b_white,f_jpg/");
  return url;
}
