import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toMoroccanInput } from "@/lib/time";
import { normalizeText, seoResult, type ScoreInput } from "./checks";
import { contentSelect } from "./select";

// Scores are computed here, saved on the product, and read from there: a list of 500 products never
// runs the rules. Anything that changes SEO content calls rescoreProducts.

const scoreSelect = { ...contentSelect, seoDuplicateTitle: true, variants: { select: { price: true } } } satisfies Prisma.ProductSelect;
type ScoreRow = Prisma.ProductGetPayload<{ select: typeof scoreSelect }>;
type DuplicateFlags = { ar: boolean; en: boolean };

/** The title each visible product shows in search, in both languages, and which ones collide. */
async function titleDuplicates() {
  const rows = await db.product.findMany({
    where: { isActive: true },
    select: { id: true, nameAr: true, nameEn: true, metaTitleAr: true, metaTitleEn: true, seoDuplicateTitle: true },
  });
  const count = (titles: string[]) => {
    const seen = new Map<string, number>();
    for (const t of titles) seen.set(t, (seen.get(t) ?? 0) + 1);
    return seen;
  };
  const key = (title: string | null, name: string) => normalizeText(title || name);
  const ar = count(rows.map((r) => key(r.metaTitleAr, r.nameAr)));
  const en = count(rows.map((r) => key(r.metaTitleEn, r.nameEn)));
  const flags = new Map<string, DuplicateFlags>();
  for (const r of rows) flags.set(r.id, { ar: ar.get(key(r.metaTitleAr, r.nameAr))! > 1, en: en.get(key(r.metaTitleEn, r.nameEn))! > 1 });
  return { flags, changed: rows.filter((r) => r.seoDuplicateTitle !== (flags.get(r.id)!.ar || flags.get(r.id)!.en)).map((r) => r.id) };
}

export function scoreInput(p: ScoreRow, duplicate: DuplicateFlags): ScoreInput {
  return {
    ...p,
    faqCount: p.faqs.length,
    schemaValid: p.images.length > 0 && p.variants.length > 0 && p.variants.every((v) => v.price > 0),
    duplicateTitleAr: duplicate.ar,
    duplicateTitleEn: duplicate.en,
  };
}

const NOT_DUPLICATE: DuplicateFlags = { ar: false, en: false };

// One statement per batch. Raw on purpose: Prisma's update would touch updatedAt, which the sitemap and
// draft undo rely on.
async function saveScores(rows: ScoreRow[], flags: Map<string, DuplicateFlags>) {
  if (!rows.length) return;
  const results = rows.map((p) => {
    const duplicate = flags.get(p.id) ?? NOT_DUPLICATE;
    return { id: p.id, duplicate: duplicate.ar || duplicate.en, ...seoResult(scoreInput(p, duplicate)) };
  });
  await db.$executeRaw`
    UPDATE "Product" AS p SET "seoScore" = r.score, "seoScoreAr" = r.score_ar, "seoScoreEn" = r.score_en,
      "seoProblems" = r.problems, "seoDuplicateTitle" = r.duplicate, "seoScoredAt" = now()
    FROM unnest(
      ${results.map((r) => r.id)}::text[], ${results.map((r) => r.score)}::int[], ${results.map((r) => r.scoreAr)}::int[],
      ${results.map((r) => r.scoreEn)}::int[], ${results.map((r) => r.problems)}::int[], ${results.map((r) => r.duplicate)}::boolean[]
    ) AS r(id, score, score_ar, score_en, problems, duplicate)
    WHERE p."id" = r.id`;
}

/** Scores these products, and any other whose title stopped or started colliding because of them. */
export async function rescoreProducts(ids: string[]) {
  const { flags, changed } = await titleDuplicates();
  const rows = await db.product.findMany({ where: { id: { in: [...new Set([...ids, ...changed])] } }, select: scoreSelect });
  await saveScores(rows, flags);
}

export async function rescoreAll() {
  const { flags } = await titleDuplicates();
  const ids = (await db.product.findMany({ select: { id: true } })).map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    await saveScores(await db.product.findMany({ where: { id: { in: ids.slice(i, i + 200) } }, select: scoreSelect }), flags);
  }
}

/** First visit after an upgrade, or products added outside the app: score what has no score yet. */
export async function ensureScored() {
  if (await db.product.count({ where: { seoScoredAt: null } })) await rescoreAll();
}

const VISIBLE = { isActive: true } satisfies Prisma.ProductWhereInput;

export async function seoOverview() {
  const [totals, red, orange, green] = await Promise.all([
    db.product.aggregate({ where: VISIBLE, _avg: { seoScore: true }, _sum: { seoProblems: true }, _count: true }),
    db.product.count({ where: { ...VISIBLE, seoScore: { lt: 50 } } }),
    db.product.count({ where: { ...VISIBLE, seoScore: { gte: 50, lt: 80 } } }),
    db.product.count({ where: { ...VISIBLE, seoScore: { gte: 80 } } }),
  ]);
  return { score: Math.round(totals._avg.seoScore ?? 0), products: totals._count, problems: totals._sum.seoProblems ?? 0, red, orange, green };
}

/** Today's point on the progress chart, kept current, and the last 30 days. */
export async function dailyHistory(overview: Awaited<ReturnType<typeof seoOverview>>) {
  const day = toMoroccanInput(new Date(), 10);
  const today = { score: overview.score, products: overview.products, green: overview.green, orange: overview.orange, red: overview.red, problems: overview.problems };
  await db.seoDailyScore.upsert({ where: { day }, create: { day, ...today }, update: today });
  return (await db.seoDailyScore.findMany({ orderBy: { day: "desc" }, take: 30 })).reverse();
}

export type TechCheck = { id: string; label: string; status: "good" | "warn" | "bad"; detail: string };

/** What can be counted in the database: fast, so it renders with the page. */
export async function contentChecks(ui: "ar" | "en" = "ar"): Promise<TechCheck[]> {
  const t = (ar: string, en: string) => (ui === "en" ? en : ar);
  const [[alts], [duplicates], [short]] = await Promise.all([
    db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "ProductImage" i JOIN "Product" p ON p."id" = i."productId"
      WHERE p."isActive" AND (btrim(i."altAr") = '' OR btrim(i."altEn") = '')`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Product" WHERE "isActive" AND "seoDuplicateTitle"`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Product" WHERE "isActive" AND (length("descriptionAr") < 150 OR length("descriptionEn") < 150)`,
  ]);
  const counted = (id: string, label: string, n: number, none: string, some: string): TechCheck => ({ id, label, status: n ? "warn" : "good", detail: n ? `${n} ${some}` : none });
  return [
    counted("alts", t("صور بلا alt", "Images without alt"), alts.n, t("كل الصور عندها alt", "Every image has alt"), t("صور بلا alt", "images without alt")),
    counted("duplicates", t("عناوين مكررة", "Duplicate titles"), duplicates.n, t("ما كاين حتى عنوان مكرر", "No duplicate title"), t("منتجات عندها نفس العنوان", "products share a title")),
    counted("short", t("أوصاف قصيرة", "Short descriptions"), short.n, t("كل الأوصاف كافية", "Every description is long enough"), t("منتجات وصفها أقل من 150 حرف", "products with a description under 150 characters")),
  ];
}

/**
 * Reads the real pages from the running site, so a green dot means it is actually served. Runs
 * in its own Suspense boundary: the rest of the page never waits for it.
 */
export async function siteChecks(origin: string, ui: "ar" | "en" = "ar"): Promise<TechCheck[]> {
  const t = (ar: string, en: string) => (ui === "en" ? en : ar);
  const read = async (path: string) => {
    try {
      const res = await fetch(origin + path, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };
  const sample = await db.product.findFirst({ where: VISIBLE, orderBy: { seoScore: "desc" }, select: { slug: true } });
  const [sitemap, robots, page] = await Promise.all([read("/sitemap.xml"), read("/robots.txt"), sample ? read(`/products/${encodeURIComponent(sample.slug)}`) : null]);

  const result = (id: string, label: string, ok: boolean | null, good: string, bad: string): TechCheck => (ok === null ? { id, label, status: "warn", detail: t("ما قدرناش نفحصها دابا", "Could not check it now") } : { id, label, status: ok ? "good" : "bad", detail: ok ? good : bad });
  const fromPage = (ok: (html: string) => boolean) => (page === null ? null : ok(page));
  return [
    result("sitemap", "sitemap", sitemap === null ? null : sitemap.includes("<urlset") && (!sample || sitemap.includes(sample.slug)), t("خدام وفيه المنتجات", "Works and lists the products"), t("ناقص ولا ما فيهش المنتجات", "Missing, or without the products")),
    result("robots", "robots.txt", robots === null ? null : robots.includes("Sitemap:") && !/^Disallow:\s*\/\s*$/m.test(robots), t("خدام وكيشير لـ sitemap", "Works and points to the sitemap"), t("كيمنع الأرشفة ولا ما فيهش sitemap", "Blocks indexing or has no sitemap")),
    result("schema", "Product schema", fromPage((h) => h.includes('"@type":"Product"')), t("كاين فصفحة المنتج", "On the product page"), t("ما لقيناهش فصفحة المنتج", "Not found on the product page")),
    result("hreflang", "hreflang", fromPage((h) => /hrefLang="ar"/i.test(h) && /hrefLang="en"/i.test(h)), t("العربية والإنجليزية مربوطين", "Arabic and English are linked"), t("ناقص فصفحة المنتج", "Missing on the product page")),
    result("openGraph", "Open Graph", fromPage((h) => h.includes('property="og:title"') && h.includes('property="og:image"')), t("العنوان والصورة كاينين", "Title and image are there"), t("ناقص فصفحة المنتج", "Missing on the product page")),
  ];
}

export type SeoColorFilter = "all" | "green" | "orange" | "red";
export type SeoSort = "asc" | "desc";
export const SEO_PAGE_SIZE = 24;

/** One page of the grid. Everything is filtered and sorted on saved, indexed columns. */
export async function seoProductPage({ q, color, sort, page }: { q: string; color: SeoColorFilter; sort: SeoSort; page: number }, ui: "ar" | "en" = "ar") {
  const where: Prisma.ProductWhereInput = {
    ...VISIBLE,
    ...(color === "red" ? { seoScore: { lt: 50 } } : color === "orange" ? { seoScore: { gte: 50, lt: 80 } } : color === "green" ? { seoScore: { gte: 80 } } : {}),
    ...(q ? { OR: [{ nameAr: { contains: q, mode: "insensitive" } }, { nameEn: { contains: q, mode: "insensitive" } }, { brand: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ seoScore: sort }, { id: "asc" }],
      skip: (page - 1) * SEO_PAGE_SIZE,
      take: SEO_PAGE_SIZE,
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        seoScore: true,
        seoScoreAr: true,
        seoScoreEn: true,
        seoProblems: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        _count: { select: { seoSuggestions: { where: { status: "PENDING" } } } },
      },
    }),
  ]);
  return {
    total,
    pages: Math.max(1, Math.ceil(total / SEO_PAGE_SIZE)),
    products: rows.map((p) => ({ id: p.id, name: ui === "en" ? p.nameEn : p.nameAr, image: p.images[0]?.url ?? null, score: p.seoScore, scoreAr: p.seoScoreAr, scoreEn: p.seoScoreEn, problems: p.seoProblems, suggestions: p._count.seoSuggestions })),
  };
}

export type SeoGridProduct = Awaited<ReturnType<typeof seoProductPage>>["products"][number];

/** The live detail behind a drawer or product page: rules run once, on this one product. */
export async function productSeoStatus(productId: string, ui: "ar" | "en" = "ar") {
  const [p, { flags }] = await Promise.all([db.product.findUnique({ where: { id: productId }, select: { ...scoreSelect, isActive: true } }), titleDuplicates()]);
  if (!p) return null;
  return { product: p, ...seoResult(scoreInput(p, flags.get(productId) ?? NOT_DUPLICATE), ui) };
}
