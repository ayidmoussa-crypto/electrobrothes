import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, TrendingUp } from "lucide-react";
import Link from "next/link";
import { runSeoJobNow } from "@/app/actions/admin-seo";
import { buttonClass } from "@/components/ui/button";
import { db } from "@/lib/db";
import { contentChecks, dailyHistory, ensureScored, seoOverview, seoProductPage, type SeoColorFilter, type SeoSort, type TechCheck } from "@/lib/seo-content/score";
import type { SeoDetail } from "@/lib/seo-content/service";
import { TIME_ZONE } from "@/lib/time";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { Suspense } from "react";
import { ActionForm } from "./ActionForm";
import { GoogleSearchCard, GoogleSearchCardSkeleton } from "./GoogleSearchCard";
import { AreaChart } from "./AreaChart";
import { CheckRows, ScoreRing, SeoGrid, SiteCheckRows } from "./SeoDashboard";
import { inputClass, PageHeader } from "./ui";

const STOPPED: Record<string, [ar: string, en: string]> = {
  budget: ["وصلنا للسقف الشهري", "monthly cap reached"],
  deadline: ["سالا الوقت", "out of time"],
  api_key: ["مفتاح Claude API ما خدامش", "Claude API key not working"],
};

export type SeoQuery = { q: string; color: SeoColorFilter; sort: SeoSort; page: number };

export function parseSeoQuery(sp: Record<string, string | string[] | undefined>): SeoQuery {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const color = one("color");
  const page = Number(one("page"));
  return {
    q: one("q").trim().slice(0, 80),
    color: color === "green" || color === "orange" || color === "red" ? color : "all",
    sort: one("sort") === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

const href = (query: SeoQuery, change: Partial<SeoQuery>) => {
  const next = { ...query, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.color !== "all") params.set("color", next.color);
  if (next.sort !== "asc") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const text = params.toString();
  return `/admin/seo${text ? `?${text}` : ""}`;
};

function Tile({ label, value, dot, link }: { label: string; value: number; dot?: string; link?: string }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-warm-600">
        {dot ? <span className={`size-2.5 rounded-full ${dot}`} aria-hidden="true" /> : null}
        {label}
      </span>
      <span className="mt-0.5 block text-2xl font-extrabold text-ink">{value}</span>
    </>
  );
  const cls = "admin-card flex flex-col justify-center p-3";
  return link ? (
    <Link href={link} className={`${cls} transition-transform hover:-translate-y-0.5`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export async function SeoPage({ query, openId, initialDetail, initialSiteChecks }: { query: SeoQuery; openId?: string; initialDetail?: SeoDetail; initialSiteChecks?: TechCheck[] }) {
  const { tr, lang } = await adminTr();
  const when = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
  const dayLabel = new Intl.DateTimeFormat(adminLocale(lang), { day: "numeric", month: "long", timeZone: "UTC" });
  await ensureScored();
  const [overview, content, grid, lastRun, settings] = await Promise.all([
    seoOverview(),
    contentChecks(lang),
    seoProductPage(query, lang),
    db.seoRun.findFirst({ orderBy: { startedAt: "desc" } }),
    db.settings.findUnique({ where: { id: 1 }, select: { seoAutoApply: true } }),
  ]);
  const history = await dailyHistory(overview);
  const filters: { id: SeoColorFilter; text: string; count: number }[] = [
    { id: "all", text: tr("الكل", "All"), count: overview.products },
    { id: "green", text: tr("أخضر", "Green"), count: overview.green },
    { id: "orange", text: tr("برتقالي", "Orange"), count: overview.orange },
    { id: "red", text: tr("أحمر", "Red"), count: overview.red },
  ];

  return (
    <>
      <PageHeader title={tr("السيو", "SEO")} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 admin-card px-3 py-2">
        <p className="min-w-0 text-xs text-warm-600">
          {tr("المهمة الليلية والتطبيق التلقائي", "Nightly job and automatic apply:")} {settings?.seoAutoApply ? tr("مفعّل", "on") : tr("مطفي", "off")}.
          {lastRun ? (
            <>
              {" "}
              {tr("آخر تشغيل", "Last run")} {lastRun.trigger === "nightly" ? tr("ليلي", "nightly") : tr("يدوي", "by hand")}: {when.format(lastRun.startedAt)} ·{" "}
              {tr(`${lastRun.generated} منتج · ${lastRun.autoApplied} تطبقو · ${lastRun.failed} فشل`, `${lastRun.generated} products · ${lastRun.autoApplied} applied · ${lastRun.failed} failed`)}
              {lastRun.stoppedBy ? ` · ${STOPPED[lastRun.stoppedBy] ? tr(...STOPPED[lastRun.stoppedBy]) : lastRun.stoppedBy}` : ""}
            </>
          ) : null}
        </p>
        <ActionForm action={runSeoJobNow} submitLabel={tr("شغّل دابا", "Run now")} className="flex flex-wrap items-center gap-2 [&_button]:!min-h-9 [&_button]:!px-3 [&_button]:!text-sm">
          <input name="limit" type="number" min={1} max={20} defaultValue={2} required dir="ltr" aria-label={tr("عدد المنتجات", "Number of products")} title={tr("عدد المنتجات", "Number of products")} className={`${inputClass} !min-h-9 !w-16 !text-sm`} />
        </ActionForm>
      </div>

      <section aria-label={tr("نظرة عامة", "Overview")} className="mb-3 grid gap-3 lg:grid-cols-[auto_1fr]">
        <div className="admin-card flex items-center justify-center gap-4 p-4">
          <ScoreRing score={overview.score} label={tr("نقطة المتجر", "Shop score")} />
          <div>
            <p className="text-sm font-extrabold text-ink">{tr("نقطة المتجر", "Shop score")}</p>
            <p className="mt-0.5 text-xs text-warm-600">{tr(`${overview.products} منتج ظاهر`, `${overview.products} visible products`)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={tr("خضرين", "Green")} value={overview.green} dot="bg-success" link={href(query, { color: "green" })} />
          <Tile label={tr("برتقاليين", "Orange")} value={overview.orange} dot="bg-warning" link={href(query, { color: "orange" })} />
          <Tile label={tr("حمرين", "Red")} value={overview.red} dot="bg-danger" link={href(query, { color: "red" })} />
          <Tile label={tr("مجموع المشاكل", "Total problems")} value={overview.problems} />
        </div>
      </section>

      <section className="mb-5 grid gap-3 lg:grid-cols-3">
        <div className="admin-card p-3">
          <h2 className="mb-1 text-sm font-extrabold text-ink">{tr("الفحوصات التقنية", "Technical checks")}</h2>
          <ul className="divide-y divide-warm-200/60">
            <SiteCheckRows initial={initialSiteChecks} />
            <CheckRows rows={content} />
          </ul>
        </div>
        {history.length >= 2 ? (
          <div className="min-w-0">
            <AreaChart lang={lang} title={tr("تطور نقطة المتجر", "Shop score over time")} unit={tr("نقطة", "points")} data={history.map((d) => ({ key: d.day, label: dayLabel.format(new Date(`${d.day}T00:00:00Z`)), value: d.score }))} />
          </div>
        ) : (
          <div className="admin-card min-w-0 p-3">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
              <TrendingUp className="size-4" aria-hidden="true" />
              {tr("تطور النقطة", "Score over time")}
            </h2>
            <p className="py-6 text-center text-sm text-warm-600">
              {tr(`بدا التسجيل اليوم بنقطة ${overview.score}.`, `Tracking started today at ${overview.score}.`)}
              <br />
              {tr("المخطط كيبان من اليوم الثاني.", "The chart shows from the second day.")}
            </p>
          </div>
        )}
        {/* Search Console answers in its own time: the rest of the page never waits for it. */}
        <Suspense fallback={<GoogleSearchCardSkeleton />}>
          <GoogleSearchCard />
        </Suspense>
      </section>

      <section aria-label={tr("المنتجات", "Products")}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <form method="get" action="/admin/seo" className="flex min-w-0 flex-1 basis-full items-center gap-2 md:basis-64">
            {query.color !== "all" ? <input type="hidden" name="color" value={query.color} /> : null}
            {query.sort !== "asc" ? <input type="hidden" name="sort" value={query.sort} /> : null}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{tr("بحث فالمنتجات", "Search products")}</span>
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-warm-600" aria-hidden="true" />
              <input name="q" defaultValue={query.q} placeholder={tr("بحث بالاسم ولا الماركة", "Search by name or brand")} className={`${inputClass} ps-9`} />
            </label>
            <button type="submit" className={buttonClass({ variant: "dark" })}>
              {tr("بحث", "Search")}
            </button>
          </form>
          <nav aria-label={tr("فلتر حسب اللون", "Filter by colour")} className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <Link key={f.id} href={href(query, { color: f.id })} aria-current={query.color === f.id ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold transition-colors ${query.color === f.id ? "bg-ink text-white" : "admin-card text-warm-800"}`}>
                {f.text} ({f.count})
              </Link>
            ))}
          </nav>
          <Link href={href(query, { sort: query.sort === "asc" ? "desc" : "asc" })} className="admin-card inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-warm-800">
            {query.sort === "asc" ? <ArrowUpNarrowWide className="size-4" aria-hidden="true" /> : <ArrowDownWideNarrow className="size-4" aria-hidden="true" />}
            {query.sort === "asc" ? tr("الأضعف أولاً", "Weakest first") : tr("الأقوى أولاً", "Strongest first")}
          </Link>
        </div>

        <SeoGrid products={grid.products} openId={openId} initialDetail={initialDetail} />

        {grid.pages > 1 ? (
          <nav aria-label={tr("الصفحات", "Pages")} className="mt-4 flex items-center justify-center gap-2 text-sm">
            {query.page > 1 ? (
              <Link href={href(query, { page: query.page - 1 })} className={buttonClass({ variant: "outline" })}>
                {tr("السابقة", "Previous")}
              </Link>
            ) : null}
            <span className="px-2 text-warm-600">
              {tr(`${query.page} من ${grid.pages}`, `${query.page} of ${grid.pages}`)}
            </span>
            {query.page < grid.pages ? (
              <Link href={href(query, { page: query.page + 1 })} className={buttonClass({ variant: "outline" })}>
                {tr("التالية", "Next")}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}
