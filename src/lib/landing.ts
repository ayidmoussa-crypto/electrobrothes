import { z } from "zod";

// Landing pages: fixed templates in code; only the texts below are written (by the owner or by Claude). Prices,
// stock, photos, dates and reviews always come from the database. Pure: shared by the admin, the store and tests.

export const TEMPLATES = ["dark_premium", "product_spotlight", "comparison", "editorial"] as const;
export type LandingTemplate = (typeof TEMPLATES)[number];

export const TEMPLATE_LABEL: Record<LandingTemplate, { ar: string; en: string; hintAr: string; hintEn: string }> = {
  dark_premium: { ar: "داكن فاخر", en: "Dark Premium", hintAr: "الافتراضي: خلفية كحلة ولمسات صفراء.", hintEn: "Default: dark background, yellow touches." },
  product_spotlight: { ar: "المنتج فالواجهة", en: "Product Spotlight", hintAr: "للمنتجات الملونة: صورة كبيرة فالوسط.", hintEn: "For colourful products: a big photo in the middle." },
  comparison: { ar: "مقارنة", en: "Comparison", hintAr: "لمنتج فيه بزاف الموديلات ولا السعات.", hintEn: "For a product with several models or capacities." },
  editorial: { ar: "تحريري", en: "Editorial", hintAr: "للمنتجات الغالية: نص كبير ومساحة واسعة.", hintEn: "For pricier products: large type, lots of space." },
};

export const isTemplate = (v: unknown): v is LandingTemplate => TEMPLATES.includes(v as LandingTemplate);

/** Sections between the hero (always first) and the order form (always last), which the owner can move or hide. */
export const MIDDLE_SECTIONS = ["features", "comparison", "warranty", "reviews"] as const;
export type MiddleSection = (typeof MIDDLE_SECTIONS)[number];
export type SectionSetting = { key: MiddleSection; hidden: boolean };

export const SECTION_LABEL: Record<"hero" | MiddleSection | "order", { ar: string; en: string }> = {
  hero: { ar: "الواجهة (الثمن وزر الطلب)", en: "Hero (price and order button)" },
  features: { ar: "مميزات المنتج", en: "Product features" },
  comparison: { ar: "مقارنة تقنية", en: "Technical comparison" },
  warranty: { ar: "الضمان والتوصيل", en: "Warranty and delivery" },
  reviews: { ar: "آراء الزبناء", en: "Customer reviews" },
  order: { ar: "استمارة الطلب", en: "Order form" },
};

export const DEFAULT_SECTIONS: SectionSetting[] = MIDDLE_SECTIONS.map((key) => ({ key, hidden: false }));

/**
 * Whatever was saved → every middle section exactly once, in the saved order, unknown keys dropped and missing ones
 * added at the end (shown). The hero and the order form are not in the list, so they can never move or hide.
 */
export function normalizeSections(input: unknown): SectionSetting[] {
  const seen = new Set<MiddleSection>();
  const out: SectionSetting[] = [];
  for (const s of Array.isArray(input) ? input : []) {
    const key = (s as { key?: unknown })?.key;
    if (!MIDDLE_SECTIONS.includes(key as MiddleSection) || seen.has(key as MiddleSection)) continue;
    seen.add(key as MiddleSection);
    out.push({ key: key as MiddleSection, hidden: (s as { hidden?: unknown }).hidden === true });
  }
  for (const key of MIDDLE_SECTIONS) if (!seen.has(key)) out.push({ key, hidden: false });
  return out;
}

/** Icons a feature may use (lucide names, drawn by components/landing/FeatureIcon.tsx). */
export const LANDING_ICONS = [
  "battery",
  "zap",
  "bluetooth",
  "wifi",
  "headphones",
  "volume",
  "mic",
  "watch",
  "smartphone",
  "shield",
  "droplets",
  "timer",
  "sparkles",
  "gauge",
  "plug",
  "cable",
  "heart",
  "sun",
] as const;
export type LandingIcon = (typeof LANDING_ICONS)[number];

export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const maxWords = (n: number) => z.string().trim().min(1).refine((s) => words(s) <= n, { message: `max_${n}_words` });

/** Strict shape and lengths: what Claude must return, and what a published page must hold. */
export const landingContentSchema = z.object({
  headline: maxWords(8),
  subline: maxWords(20),
  features: z.array(z.object({ title: maxWords(4), text: maxWords(15), icon: z.enum(LANDING_ICONS) })).min(3).max(5),
  comparison: z.array(z.object({ label: z.string().trim().min(1).max(60), values: z.array(z.string().trim().max(60)).min(1).max(6) })).max(10).optional(),
  faq: z.array(z.object({ q: z.string().trim().min(1).max(160), a: z.string().trim().min(1).max(400) })).max(6).optional(),
});
export type LandingContent = z.infer<typeof landingContentSchema>;

/** The owner's draft: same shape, looser (a half-written feature is allowed while editing). Characters, not words. */
export const landingDraftSchema = z.object({
  headline: z.string().trim().max(120),
  subline: z.string().trim().max(240),
  features: z.array(z.object({ title: z.string().trim().max(60), text: z.string().trim().max(200), icon: z.enum(LANDING_ICONS) })).max(5),
  comparison: z.array(z.object({ label: z.string().trim().max(60), values: z.array(z.string().trim().max(60)).max(6) })).max(10).default([]),
  faq: z.array(z.object({ q: z.string().trim().max(160), a: z.string().trim().max(400) })).max(6).default([]),
});
export type LandingDraft = z.infer<typeof landingDraftSchema>;

/** Empty rows dropped, so a draft can be shown or checked as content. */
export function cleanDraft(d: LandingDraft): LandingDraft {
  return {
    headline: d.headline.trim(),
    subline: d.subline.trim(),
    features: d.features.filter((f) => f.title.trim() || f.text.trim()),
    comparison: d.comparison.filter((r) => r.label.trim() && r.values.some((v) => v.trim())),
    faq: d.faq.filter((f) => f.q.trim() && f.a.trim()),
  };
}

/** Why a draft cannot be published yet, worded for the owner; empty when it can. */
export function publishProblems(d: LandingDraft, ui: "ar" | "en" = "ar"): string[] {
  const t = (ar: string, en: string) => (ui === "en" ? en : ar);
  const c = cleanDraft(d);
  const problems: string[] = [];
  if (!c.headline) problems.push(t("العنوان خاوي.", "The headline is empty."));
  else if (words(c.headline) > 8) problems.push(t("العنوان فيه أكثر من 8 كلمات.", "The headline has more than 8 words."));
  if (!c.subline) problems.push(t("الجملة تحت العنوان خاوية.", "The line under the headline is empty."));
  else if (words(c.subline) > 20) problems.push(t("الجملة تحت العنوان فيها أكثر من 20 كلمة.", "The line under the headline has more than 20 words."));
  if (c.features.length < 3) problems.push(t("خاص 3 مميزات على الأقل.", "At least 3 features are needed."));
  c.features.forEach((f, i) => {
    if (!f.title || !f.text) problems.push(t(`الميزة ${i + 1} ناقصة.`, `Feature ${i + 1} is incomplete.`));
    else if (words(f.title) > 4 || words(f.text) > 15) problems.push(t(`الميزة ${i + 1} طويلة (4 كلمات للعنوان، 15 للنص).`, `Feature ${i + 1} is too long (4 words title, 15 text).`));
  });
  return problems;
}

// ───────── Default copy from the product's own data (no AI) ─────────

export type LandingSource = {
  nameAr: string;
  descriptionAr: string;
  highlightsAr: string[];
  specs: { key: string; valueAr: string }[];
  faqs: { questionAr: string; answerAr: string }[];
};

const clip = (s: string, n: number) => s.trim().split(/\s+/).filter(Boolean).slice(0, n).join(" ");

/** First sentence of a text, cut to `n` words. */
const firstSentence = (s: string, n: number) => clip(s.split(/(?<=[.!؟?])\s+/)[0] ?? "", n).replace(/[،,:;]$/, "");

export const SPEC_ICON: Record<string, LandingIcon> = {
  battery: "battery",
  power: "zap",
  connectivity: "bluetooth",
  anc: "headphones",
  water: "droplets",
  port: "plug",
  length: "cable",
  capacity: "battery",
  screen: "smartphone",
  camera: "sparkles",
};

/** Arabic labels of the spec keys the shop uses (same words as messages/ar.json "specs"). */
export const SPEC_LABEL_AR: Record<string, string> = {
  ram: "الذاكرة العشوائية",
  storage: "السعة التخزينية",
  screen: "الشاشة",
  cpu: "المعالج",
  gpu: "معالج الرسوميات",
  camera: "الكاميرا",
  battery: "البطارية",
  type: "النوع",
  anc: "إلغاء الضوضاء",
  connectivity: "الاتصال",
  power: "القوة",
  port: "المنفذ",
  capacity: "السعة",
  length: "الطول",
  water: "مقاومة الماء",
};

/**
 * Safe copy built only from what the product already says: its name, the first sentence of its description, its
 * highlights (then its specs) as features, and its own FAQ. Used for a new page and when Claude's answer is unusable.
 * It never adds a fact, so it may hold fewer than 3 features; the owner then completes them before publishing.
 */
export function defaultLandingContent(p: LandingSource): LandingDraft {
  const fromHighlights = p.highlightsAr
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => {
      // "Title: text" or "Title – text"; a hyphen inside a word (USB-C, Wi-Fi) is not a separator.
      const [head, ...rest] = h.split(/\s*:\s*|\s+[–-]\s+/);
      if (rest.length) return { title: clip(head, 4), text: clip(rest.join(" "), 15), icon: "sparkles" as LandingIcon };
      // No separator: the first words become the title and the rest the text, so the two never repeat each other.
      const all = h.split(/\s+/);
      const cut = all.length > 5 ? 3 : all.length;
      return { title: all.slice(0, cut).join(" "), text: clip(all.slice(cut).join(" ") || h, 15), icon: "sparkles" as LandingIcon };
    });
  const fromSpecs = p.specs
    .filter((s) => s.valueAr.trim())
    .map((s) => ({ title: clip(SPEC_LABEL_AR[s.key] ?? s.key, 4), text: clip(s.valueAr, 15), icon: SPEC_ICON[s.key] ?? ("sparkles" as LandingIcon) }));
  return {
    headline: clip(p.nameAr, 8),
    subline: firstSentence(p.descriptionAr, 20),
    features: [...fromHighlights, ...fromSpecs].slice(0, 5),
    comparison: [],
    faq: p.faqs.slice(0, 6).map((f) => ({ q: f.questionAr, a: f.answerAr })),
  };
}

// ───────── Rules for the AI (lib/assistant/campaigns.ts) ─────────

/**
 * The template for a product, by fixed rules rather than left to the model: several models or capacities →
 * comparison; priced from the owner's threshold → editorial; several colours → product spotlight; else dark premium.
 */
export function chooseTemplate(p: { variants: { storage: string | null; colorAr: string | null; price: number }[] }, editorialFrom: number): LandingTemplate {
  const capacities = new Set(p.variants.map((v) => v.storage?.trim()).filter(Boolean));
  if (capacities.size >= 2) return "comparison";
  if (Math.min(...p.variants.map((v) => v.price)) >= editorialFrom) return "editorial";
  const colours = new Set(p.variants.map((v) => v.colorAr?.trim()).filter(Boolean));
  if (colours.size >= 2) return "product_spotlight";
  return "dark_premium";
}

/** Every number written in a text ("30", "5.3", "٤٠" as 40). */
export function numbersIn(text: string): string[] {
  const western = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return western.match(/\d+(?:[.,]\d+)?/g)?.map((n) => n.replace(",", ".")) ?? [];
}

/** Numbers the generated texts hold that the product's own data does not: any one means an invented fact. */
export function inventedNumbers(texts: string[], facts: string): string[] {
  const allowed = new Set(numbersIn(facts));
  return [...new Set(texts.flatMap(numbersIn))].filter((n) => !allowed.has(n));
}

/** All the texts of a page's content, for the checks above. */
export const contentTexts = (c: LandingDraft) => [c.headline, c.subline, ...c.features.flatMap((f) => [f.title, f.text]), ...c.comparison.flatMap((r) => [r.label, ...r.values]), ...c.faq.flatMap((f) => [f.q, f.a])];

/** The shape stored in LandingPage.published. */
export type PublishedLanding = { template: LandingTemplate; sections: SectionSetting[]; content: LandingDraft };

/** A stored `published` value read back safely; null when it is missing or broken. */
export function readPublished(v: unknown): PublishedLanding | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const content = landingDraftSchema.safeParse(o.content);
  if (!content.success || !isTemplate(o.template)) return null;
  return { template: o.template, sections: normalizeSections(o.sections), content: cleanDraft(content.data) };
}
