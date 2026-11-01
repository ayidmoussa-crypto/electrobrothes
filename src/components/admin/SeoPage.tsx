import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, TrendingUp } from "lucide-react";
import Link from "next/link";
import { runSeoJobNow } from "@/app/actions/admin-seo";
import { buttonClass } from "@/components/ui/button";
import { db } from "@/lib/db";
import { contentChecks, dailyHistory, ensureScored, seoOverview, seoProductPage, type SeoColorFilter, type SeoSort, type TechCheck } from "@/lib/seo-content/score";
import type { SeoDetail } from "@/lib/seo-content/service";
import { TIME_ZONE } from "@/lib/time";
import { ActionForm } from "./ActionForm";
import { AreaChart } from "./AreaChart";
import { CheckRows, ScoreRing, SeoGrid, SiteCheckRows } from "./SeoDashboard";
import { inputClass, PageHeader } from "./ui";

const when = new Intl.DateTimeFormat("ar-MA", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
const dayLabel = new Intl.DateTimeFormat("ar-MA", { day: "numeric", month: "long", timeZone: "UTC" });
const STOPPED: Record<string, string> = { budget: "وصلنا للسقف الشهري", deadline: "سالا الوقت", api_key: "مفتاح Claude API ما خدامش" };

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
  await ensureScored();
  const [overview, content, grid, lastRun, settings] = await Promise.all([
    seoOverview(),
    contentChecks(),
    seoProductPage(query),
    db.seoRun.findFirst({ orderBy: { startedAt: "desc" } }),
    db.settings.findUnique({ where: { id: 1 }, select: { seoAutoApply: true } }),
  ]);
  const history = await dailyHistory(overview);
  const filters: { id: SeoColorFilter; text: string; count: number }[] = [
    { id: "all", text: "الكل", count: overview.products },
    { id: "green", text: "أخضر", count: overview.green },
    { id: "orange", text: "برتقالي", count: overview.orange },
    { id: "red", text: "أحمر", count: overview.red },
  ];

  return (
    <>
      <PageHeader title="السيو" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 admin-card px-3 py-2">
        <p className="min-w-0 text-xs text-warm-600">
          المهمة الليلية والتطبيق التلقائي {settings?.seoAutoApply ? "مفعّل" : "مطفي"}.
          {lastRun ? (
            <>
              {" "}
              آخر تشغيل {lastRun.trigger === "nightly" ? "ليلي" : "يدوي"}: {when.format(lastRun.startedAt)} · {lastRun.generated} منتج · {lastRun.autoApplied} تطبقو · {lastRun.failed} فشل
              {lastRun.stoppedBy ? ` · ${STOPPED[lastRun.stoppedBy] ?? lastRun.stoppedBy}` : ""}
            </>
          ) : null}
        </p>
        <ActionForm action={runSeoJobNow} submitLabel="شغّل دابا" className="flex flex-wrap items-center gap-2 [&_button]:!min-h-9 [&_button]:!px-3 [&_button]:!text-sm">
          <input name="limit" type="number" min={1} max={20} defaultValue={2} required dir="ltr" aria-label="عدد المنتجات" title="عدد المنتجات" className={`${inputClass} !min-h-9 !w-16 !text-sm`} />
        </ActionForm>
      </div>

      <section aria-label="نظرة عامة" className="mb-3 grid gap-3 lg:grid-cols-[auto_1fr]">
        <div className="admin-card flex items-center justify-center gap-4 p-4">
          <ScoreRing score={overview.score} label="نقطة المتجر" />
          <div>
            <p className="text-sm font-extrabold text-ink">نقطة المتجر</p>
            <p className="mt-0.5 text-xs text-warm-600">{overview.products} منتج ظاهر</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="خضرين" value={overview.green} dot="bg-success" link={href(query, { color: "green" })} />
          <Tile label="برتقاليين" value={overview.orange} dot="bg-warning" link={href(query, { color: "orange" })} />
          <Tile label="حمرين" value={overview.red} dot="bg-danger" link={href(query, { color: "red" })} />
          <Tile label="مجموع المشاكل" value={overview.problems} />
        </div>
      </section>

      <section className="mb-5 grid gap-3 lg:grid-cols-3">
        <div className="admin-card p-3">
          <h2 className="mb-1 text-sm font-extrabold text-ink">الفحوصات التقنية</h2>
          <ul className="divide-y divide-warm-200/60">
            <SiteCheckRows initial={initialSiteChecks} />
            <CheckRows rows={content} />
          </ul>
        </div>
        {history.length >= 2 ? (
          <div className="min-w-0">
            <AreaChart title="تطور نقطة المتجر" unit="نقطة" data={history.map((d) => ({ key: d.day, label: dayLabel.format(new Date(`${d.day}T00:00:00Z`)), value: d.score }))} />
          </div>
        ) : (
          <div className="admin-card min-w-0 p-3">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
              <TrendingUp className="size-4" aria-hidden="true" />
              تطور النقطة
            </h2>
            <p className="py-6 text-center text-sm text-warm-600">
              بدا التسجيل اليوم بنقطة {overview.score}.
              <br />
              المخطط كيبان من اليوم الثاني.
            </p>
          </div>
        )}
        <div className="admin-card p-3">
          <h2 className="mb-2 text-sm font-extrabold text-ink">بيانات Google</h2>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {["الظهور", "النقرات", "الترتيب"].map((label) => (
              <div key={label} className="rounded-lg bg-white/50 p-2">
                <dt className="text-xs text-warm-600">{label}</dt>
                <dd className="mt-0.5 text-xl font-extrabold text-warm-500">—</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-warm-600">كتتربط ملي يطلع السيت للأنترنت.</p>
        </div>
      </section>

      <section aria-label="المنتجات">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <form method="get" action="/admin/seo" className="flex min-w-0 flex-1 basis-full items-center gap-2 md:basis-64">
            {query.color !== "all" ? <input type="hidden" name="color" value={query.color} /> : null}
            {query.sort !== "asc" ? <input type="hidden" name="sort" value={query.sort} /> : null}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">بحث فالمنتجات</span>
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-warm-600" aria-hidden="true" />
              <input name="q" defaultValue={query.q} placeholder="بحث بالاسم ولا الماركة" className={`${inputClass} ps-9`} />
            </label>
            <button type="submit" className={buttonClass({ variant: "dark" })}>
              بحث
            </button>
          </form>
          <nav aria-label="فلتر حسب اللون" className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <Link key={f.id} href={href(query, { color: f.id })} aria-current={query.color === f.id ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold transition-colors ${query.color === f.id ? "bg-ink text-white" : "admin-card text-warm-800"}`}>
                {f.text} ({f.count})
              </Link>
            ))}
          </nav>
          <Link href={href(query, { sort: query.sort === "asc" ? "desc" : "asc" })} className="admin-card inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-warm-800">
            {query.sort === "asc" ? <ArrowUpNarrowWide className="size-4" aria-hidden="true" /> : <ArrowDownWideNarrow className="size-4" aria-hidden="true" />}
            {query.sort === "asc" ? "الأضعف أولاً" : "الأقوى أولاً"}
          </Link>
        </div>

        <SeoGrid products={grid.products} openId={openId} initialDetail={initialDetail} />

        {grid.pages > 1 ? (
          <nav aria-label="الصفحات" className="mt-4 flex items-center justify-center gap-2 text-sm">
            {query.page > 1 ? (
              <Link href={href(query, { page: query.page - 1 })} className={buttonClass({ variant: "outline" })}>
                السابقة
              </Link>
            ) : null}
            <span className="px-2 text-warm-600">
              {query.page} من {grid.pages}
            </span>
            {query.page < grid.pages ? (
              <Link href={href(query, { page: query.page + 1 })} className={buttonClass({ variant: "outline" })}>
                التالية
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}
