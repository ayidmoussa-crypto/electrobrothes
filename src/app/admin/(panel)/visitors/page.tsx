import { Eye, MonitorSmartphone, ShoppingCart, UserPlus, Users } from "lucide-react";
import { AreaChart } from "@/components/admin/AreaChart";
import { PeriodPicker } from "@/components/admin/PeriodPicker";
import { PageHeader, Panel, Stat, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { channelLabel } from "@/lib/attribution";
import { formatMAD } from "@/lib/money";
import { chartSlots, periodLabel, resolvePeriod } from "@/lib/period";
import { toMoroccanInput } from "@/lib/time";
import { funnelSteps, pct, VISIT_RETENTION_DAYS } from "@/lib/visitors";
import { loadVisitors } from "@/lib/visitors-data";

const STEP_LABEL = {
  sessions: ["زيارات", "Visits"],
  productViews: ["شافو منتوج", "Viewed a product"],
  carts: ["زادو للسلة", "Added to cart"],
  checkouts: ["بداو الطلب", "Started checkout"],
  orders: ["طلبو", "Ordered"],
  confirmed: ["تأكدات", "Confirmed"],
  delivered: ["وصلات", "Delivered"],
} as const;

const DEVICE_LABEL: Record<string, [string, string]> = { mobile: ["تيليفون", "Phone"], tablet: ["تابليت", "Tablet"], desktop: ["حاسوب", "Computer"] };

/** Anonymous shop analytics: how many people visit, from where, what they do, and where they stop before buying. */
export default async function VisitorsPage({ searchParams }: PageProps<"/admin/visitors">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const ar = lang === "ar";
  const period = resolvePeriod(await searchParams, new Date(), "30d");
  const span = periodLabel(period, lang);
  const v = await loadVisitors(period);
  const steps = funnelSteps(v.funnel);
  const series = chartSlots(v.daily.map((d) => ({ day: d.day, count: d.visitors })), period);
  const dayFmt = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const monthFmt = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  const sinceFmt = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { dateStyle: "medium", timeZone: "Africa/Casablanca" });
  const mad = (n: number) => formatMAD(n, lang);
  const name = (p: { nameAr: string; nameEn: string } | null) => (p ? (ar ? p.nameAr : p.nameEn) : tr("منتوج تمسح", "Deleted product"));
  const empty = (text: string) => <p className="text-sm text-warm-600">{text}</p>;
  const noData = tr("مازال ما كاين حتى زائر فهاد الفترة.", "No visitors in this period yet.");

  return (
    <div>
      <PageHeader
        title={tr("الزوار والسلوك", "Visitors & behaviour")}
        description={tr(`شحال من واحد كيدخل، منين، شنو كيدير، وفين كيوقف قبل ما يشري · ${span}`, `Who visits, from where, what they do and where they stop before buying · ${span}`)}
      />
      <div className="mb-4">
        <PeriodPicker key={period.query} basePath="/admin/visitors" preset={period.preset} firstDay={period.firstDay} lastDay={period.lastDay} today={toMoroccanInput(new Date(), 10)} lang={lang} label={tr("الفترة", "Period")} />
      </div>
      <p className="mb-4 text-xs text-warm-600">
        {v.trackingSince
          ? tr(`التتبع بدا ${sinceFmt.format(v.trackingSince)}. التفاصيل كتبقى ${VISIT_RETENTION_DAYS} يوم. بلا سميات ولا تيليفونات، والروبوتات والفريق ديالك ما كيتحسبوش.`, `Tracking started ${sinceFmt.format(v.trackingSince)}. Details are kept ${VISIT_RETENTION_DAYS} days. No names or phones; robots and your team are not counted.`)
          : tr("التتبع مازال ما بدا: الأرقام كتبان ملي يدخل أول زائر.", "Tracking has not started yet: figures appear with the first visitor.")}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={tr("الزوار", "Visitors")} value={String(v.visitors)} icon={Users} hint={tr(`${v.sessions} زيارة`, `${v.sessions} visits`)} />
        <Stat label={tr("زوار جداد", "New visitors")} value={String(v.newVisitors)} icon={UserPlus} hint={tr(`${pct(v.newVisitors, v.visitors)}% من الزوار`, `${pct(v.newVisitors, v.visitors)}% of visitors`)} />
        <Stat label={tr("الصفحات المشاهدة", "Page views")} value={String(v.views)} icon={Eye} hint={tr(`${v.sessions ? (v.views / v.sessions).toFixed(1) : 0} صفحة فكل زيارة`, `${v.sessions ? (v.views / v.sessions).toFixed(1) : 0} pages per visit`)} />
        <Stat label={tr("نسبة الشراء", "Conversion rate")} value={`${pct(v.buyers, v.visitors)}%`} icon={ShoppingCart} hint={tr(`${v.buyers} زائر طلب`, `${v.buyers} visitors ordered`)} />
        <Stat label={tr("سلات متروكة", "Abandoned carts")} value={String(v.abandoned.visitors)} icon={MonitorSmartphone} hint={tr(`قيمتها ${mad(v.abandoned.value)}`, `Worth ${mad(v.abandoned.value)}`)} />
      </div>

      <div className="mt-3">
        <AreaChart
          title={series.monthly ? tr("الزوار فكل شهر", "Visitors per month") : tr("الزوار فكل نهار", "Visitors per day")}
          unit={tr("زائر", "visitors")}
          lang={lang}
          data={series.points.map((d) => ({ key: d.key, label: (series.monthly ? monthFmt : dayFmt).format(new Date(`${d.key}T00:00:00Z`)), value: d.count }))}
        />
      </div>

      <Panel title={tr("مسار الشراء: فين كيوقفو الناس", "Purchase path: where people stop")} className="mt-3">
        {v.funnel.sessions ? (
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={s.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink">{STEP_LABEL[s.key][ar ? 0 : 1]}</span>
                  <span className="text-warm-600">
                    <b className="text-ink">{s.count}</b> · {s.ofVisits}% {tr("من الزيارات", "of visits")}
                    {i > 0 ? <> · {tr(`${s.fromPrevious}% من الخطوة اللي قبل`, `${s.fromPrevious}% of the step before`)}</> : null}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-warm-100" aria-hidden="true">
                  <div className={`h-full rounded-full ${i < 4 ? "bg-ink" : "bg-yellow-500"}`} style={{ width: `${Math.max(s.ofVisits, s.count ? 1 : 0)}%` }} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          empty(noData)
        )}
        <p className="mt-3 text-xs text-warm-500">{tr("الأرقام بالزيارات (كل زيارة تتحسب مرة فكل خطوة). «تأكدات» و«وصلات» هوما الطلبيات اللي تطلبو فهاد الزيارات.", "Counted in visits (each visit once per step). “Confirmed” and “Delivered” are the orders placed during these visits.")}</p>
      </Panel>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title={tr("منين جاو", "Where they come from")} className="min-w-0">
          {v.sources.length ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>{tr("المصدر", "Source")}</th>
                  <th scope="col" className={thClass}>{tr("الزوار", "Visitors")}</th>
                  <th scope="col" className={thClass}>{tr("طلبو", "Ordered")}</th>
                  <th scope="col" className={thClass}>{tr("النسبة", "Rate")}</th>
                </tr>
              </thead>
              <tbody>
                {v.sources.map((s) => (
                  <tr key={s.channel ?? "none"} className="border-t border-warm-200">
                    <th scope="row" className={`${tdClass} text-start font-semibold text-ink`}>{channelLabel(s.channel ?? "DIRECT", lang)}</th>
                    <td className={tdClass}>{s.visitors}</td>
                    <td className={tdClass}>{s.buyers}</td>
                    <td className={`${tdClass} font-semibold text-ink`}>{pct(s.buyers, s.visitors)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            empty(noData)
          )}
        </Panel>

        <Panel title={tr("المدن والأجهزة", "Cities and devices")} className="min-w-0">
          {v.cities.length || v.devices.length ? (
            <>
              <ul className="flex flex-col gap-2">
                {v.cities.map((c) => (
                  <li key={c.city} className="flex justify-between gap-3 text-sm">
                    <span className="text-ink">{c.city}</span>
                    <span className="text-warm-600">{c.visitors}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-warm-200 pt-3">
                {v.devices.map((d) => (
                  <span key={d.device} className="rounded-full bg-warm-100 px-3 py-1 text-sm text-warm-800">
                    {(DEVICE_LABEL[d.device] ?? [d.device, d.device])[ar ? 0 : 1]} · <b className="text-ink">{pct(d.visitors, v.visitors)}%</b>
                  </span>
                ))}
              </div>
            </>
          ) : (
            empty(noData)
          )}
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title={tr("المنتوجات: شافوها، زادوها، طلبوها", "Products: viewed, added, ordered")} className="min-w-0">
          {v.products.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>{tr("المنتوج", "Product")}</th>
                    <th scope="col" className={thClass}>{tr("شافوه", "Viewed")}</th>
                    <th scope="col" className={thClass}>{tr("للسلة", "To cart")}</th>
                    <th scope="col" className={thClass}>{tr("طلبات", "Orders")}</th>
                  </tr>
                </thead>
                <tbody>
                  {v.products.map((p, i) => {
                    // Seen a lot, rarely bought: a price, photo or description to look at.
                    const cold = p.viewers >= 10 && p.orders / p.viewers < 0.02;
                    return (
                      <tr key={i} className="border-t border-warm-200">
                        <th scope="row" className={`${tdClass} max-w-56 text-start font-semibold text-ink`}>
                          <span className="block truncate">{name(p.product)}</span>
                          {cold ? <span className="block text-xs font-normal text-warning-text">{tr("كيشوفوه بزاف وما كيشريوهش", "Viewed a lot, rarely bought")}</span> : null}
                        </th>
                        <td className={tdClass}>{p.viewers}</td>
                        <td className={tdClass}>{p.adders}</td>
                        <td className={tdClass}>{p.orders}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            empty(noData)
          )}
        </Panel>

        <Panel title={tr("السلات المتروكة: أشمن منتوجات", "Abandoned carts: which products")} className="min-w-0">
          {v.abandonedProducts.length ? (
            <ul className="flex flex-col gap-2">
              {v.abandonedProducts.map((p, i) => (
                <li key={i} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{name(p.product)}</span>
                  <span className="shrink-0 text-warm-600">
                    {tr(`${p.visitors} زائر`, `${p.visitors} visitors`)} · {mad(p.value)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            empty(tr("ما كاين حتى سلة متروكة فهاد الفترة.", "No abandoned carts in this period."))
          )}
          <p className="mt-3 text-xs text-warm-500">{tr("زائر زاد منتوج للسلة وما طلب والو فهاد الفترة. القيمة هي داكشي اللي زاد.", "A visitor who added to the cart and placed no order in the period. Value is what they added.")}</p>
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title={tr("شنو كيقلبو عليه", "What they search for")} className="min-w-0">
          {v.searches.length ? (
            <ul className="flex flex-col gap-2">
              {v.searches.map((s) => (
                <li key={s.query} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink" dir="auto">{s.query}</span>
                  <span className="shrink-0 text-warm-600">{s.times}</span>
                </li>
              ))}
            </ul>
          ) : (
            empty(tr("مازال ما كاين حتى بحث.","No searches yet."))
          )}
        </Panel>
        <Panel title={tr("قلبو عليه وما لقاوهش", "Searched, not found")} className="min-w-0">
          {v.emptySearches.length ? (
            <ul className="flex flex-col gap-2">
              {v.emptySearches.map((s) => (
                <li key={s.query} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink" dir="auto">{s.query}</span>
                  <span className="shrink-0 text-warm-600">{s.times}</span>
                </li>
              ))}
            </ul>
          ) : (
            empty(tr("حتى بحث بلا نتيجة. مزيان.", "No search came back empty."))
          )}
          <p className="mt-3 text-xs text-warm-500">{tr("سلعة كيطلبوها الناس وما عندكش، ولا سمية ما كتبانش فالبحث.", "Products people want that you do not have, or names the search does not match.")}</p>
        </Panel>
        <Panel title={tr("الصفحات الأكثر زيارة", "Most visited pages")} className="min-w-0">
          {v.pages.length ? (
            <ul className="flex flex-col gap-2">
              {v.pages.map((p) => (
                <li key={p.path} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink" dir="ltr">{p.path}</span>
                  <span className="shrink-0 text-warm-600">{p.views}</span>
                </li>
              ))}
            </ul>
          ) : (
            empty(noData)
          )}
        </Panel>
      </div>
    </div>
  );
}
