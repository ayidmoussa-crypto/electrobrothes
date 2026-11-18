import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ChevronLeft, Globe, Plus, Store } from "lucide-react";
import Link from "next/link";
import { PeriodPicker } from "@/components/admin/PeriodPicker";
import { PageHeader, StatusBadge, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr, type AdminLang } from "@/lib/admin-lang";
import { loadSalesComparison } from "@/lib/finance-data";
import { formatMAD } from "@/lib/money";
import type { OrderStatus } from "@/lib/order-rules";
import { periodLabel, resolvePeriod } from "@/lib/period";
import { toMoroccanInput } from "@/lib/time";

const card = "rounded-3xl bg-warm-50 p-4 ring-1 ring-warm-200 md:p-5";

function SideCard({ icon: Icon, title, hint, revenue, line, mad }: { icon: LucideIcon; title: string; hint: string; revenue: number; line: string; mad: (v: number) => string }) {
  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-warm-600">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-yellow-500">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {title}
      </h2>
      <p className="mt-3 text-3xl font-extrabold text-ink">{mad(revenue)}</p>
      <p className="mt-1 text-sm font-semibold text-warm-800">{line}</p>
      <p className="mt-1 text-xs text-warm-600">{hint}</p>
    </section>
  );
}

type Row = { id: string; number: string; customerName: string; total: number; status: OrderStatus };

function Latest({ title, empty, rows, lang, mad }: { title: string; empty: string; rows: Row[]; lang: AdminLang; mad: (v: number) => string }) {
  return (
    <section className={`${card} min-w-0`}>
      <h2 className="mb-2 text-base text-ink">{title}</h2>
      {rows.length ? (
        <ul>
          {rows.map((o) => (
            <li key={o.id} className="border-t border-warm-200">
              <Link href={`/admin/orders/${o.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-lg py-2 hover:bg-warm-100">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{o.customerName}</span>
                  <span className="block font-mono text-xs text-warm-600" dir="ltr">
                    {o.number}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold text-ink">{mad(o.total)}</span>
                  <StatusBadge status={o.status} lang={lang} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-warm-200 pt-3 text-sm text-warm-600">{empty}</p>
      )}
    </section>
  );
}

export default async function SalesPage({ searchParams }: PageProps<"/admin/sales">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const mad = (v: number) => formatMAD(v, lang);
  const period = resolvePeriod(await searchParams);
  const span = periodLabel(period, lang);
  const today = toMoroccanInput(new Date(), 10);
  const { online, shop, total, onlineShare, shopShare, latestOnline, latestShop } = await loadSalesComparison(period);

  const count = (v: number) => String(v);
  const money = (v: number | null) => (v === null ? "—" : mad(v));
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
  const rows: { label: string; online: string; shop: string }[] = [
    { label: tr("المبيعات", "Sales"), online: mad(online.revenue), shop: mad(shop.revenue) },
    { label: tr("عدد البيعات", "Number of sales"), online: count(online.sales), shop: count(shop.sales) },
    { label: tr("القطع المبيوعة", "Units sold"), online: count(online.units), shop: count(shop.units) },
    { label: tr("متوسط البيعة", "Average sale"), online: money(online.average), shop: money(shop.average) },
    { label: tr("الربح قبل المصاريف", "Profit before expenses"), online: mad(online.profit), shop: mad(shop.profit) },
    { label: tr("الهامش", "Margin"), online: pct(online.margin), shop: pct(shop.margin) },
    { label: tr("الطرود الراجعة", "Returned parcels"), online: count(online.returned), shop: "—" },
    { label: tr("نسبة الرفض", "Refusal rate"), online: pct(online.refusalRate), shop: "—" },
  ];
  const noCost = online.unitsWithoutCost + shop.unitsWithoutCost;
  const sold = (n: number, average: number | null) => (average === null ? tr("ما كاين حتى بيع", "No sales") : tr(`${n} بيعة · المتوسط ${mad(average)}`, `${n} sales · average ${mad(average)}`));

  return (
    <div>
      <PageHeader
        title={tr("أونلاين والمحل", "Online and shop")}
        description={tr(`مقارنة المبيعات · ${span}`, `Sales compared · ${span}`)}
        actions={
          <>
            <Link href="/admin/orders/new?shop=1" className={buttonClass()}>
              <Store className="size-4" aria-hidden="true" />
              {tr("بيع فالمحل", "Shop sale")}
            </Link>
            <Link href="/admin/orders/new" className={buttonClass({ variant: "outline" })}>
              <Plus className="size-4" aria-hidden="true" />
              {tr("طلب للتوصيل", "Order to deliver")}
            </Link>
          </>
        }
      />
      <div className="mb-4">
        <PeriodPicker key={period.query} basePath="/admin/sales" preset={period.preset} firstDay={period.firstDay} lastDay={period.lastDay} today={today} lang={lang} label={tr("الفترة", "Period")} />
      </div>

      {noCost ? (
        <p className="mb-3 flex items-center gap-2 rounded-2xl bg-warning-soft p-4 text-sm font-semibold text-warning-text">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          {tr(`${noCost} قطعة مبيوعة بلا ثمن شراء: الربح الحقيقي أقل من الرقم اللي هنا.`, `${noCost} sold units have no purchase price: the real profit is lower than shown.`)}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <SideCard icon={Globe} title={tr("أونلاين", "Online")} hint={tr("الموقع، واتساب، المكالمات ومواقع التواصل", "Website, WhatsApp, calls and social media")} revenue={online.revenue} line={sold(online.sales, online.average)} mad={mad} />
        <SideCard icon={Store} title={tr("المحل", "Shop")} hint={tr("اللي تباع وتسلّم فالمحل", "Sold and handed over at the shop")} revenue={shop.revenue} line={sold(shop.sales, shop.average)} mad={mad} />
      </div>

      <section className={`${card} mt-3`} aria-labelledby="share-title">
        <h2 id="share-title" className="text-base text-ink">
          {tr("حصة كل واحد من المبيعات", "Share of sales")}
        </h2>
        {total ? (
          <>
            <div className="mt-3 flex h-4 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {online.revenue ? <span className="bg-ink" style={{ flexGrow: online.revenue }} /> : null}
              {shop.revenue ? <span className="bg-yellow-500" style={{ flexGrow: shop.revenue }} /> : null}
            </div>
            <dl className="mt-3 flex justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-ink" aria-hidden="true" />
                <dt className="text-warm-600">{tr("أونلاين", "Online")}</dt>
                <dd className="font-bold text-ink">{onlineShare}%</dd>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-yellow-500" aria-hidden="true" />
                <dt className="text-warm-600">{tr("المحل", "Shop")}</dt>
                <dd className="font-bold text-ink">{shopShare}%</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm text-warm-600">{tr("ما كاين حتى بيع فهاد الفترة.", "No sales in this period.")}</p>
        )}
      </section>

      <section className={`${card} mt-3`} aria-labelledby="compare-title">
        <h2 id="compare-title" className="mb-3 text-base text-ink">
          {tr("المقارنة", "Comparison")}
        </h2>
        <div className="overflow-hidden rounded-2xl ring-1 ring-warm-200">
          <table className="w-full table-fixed bg-white">
            <thead className="bg-warm-100">
              <tr>
                <th scope="col" className={`${thClass} w-2/5`}>{tr("الرقم", "Figure")}</th>
                <th scope="col" className={thClass}>{tr("أونلاين", "Online")}</th>
                <th scope="col" className={thClass}>{tr("المحل", "Shop")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-warm-200">
                  <th scope="row" className={`${tdClass} text-start font-normal text-warm-600`}>{r.label}</th>
                  <td className={`${tdClass} font-semibold text-ink`}>{r.online}</td>
                  <td className={`${tdClass} font-semibold text-ink`}>{r.shop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Latest title={tr("آخر طلبات أونلاين", "Latest online orders")} empty={tr("مازال ما كاين حتى طلب.", "No orders yet.")} rows={latestOnline} lang={lang} mad={mad} />
        <Latest title={tr("آخر بيعات المحل", "Latest shop sales")} empty={tr("مازال ما تسجل حتى بيع فالمحل.", "No shop sale recorded yet.")} rows={latestShop} lang={lang} mad={mad} />
      </div>
      <Link href="/admin/orders" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink underline-offset-4 hover:underline">
        {tr("كل الطلبات", "All orders")}
        <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
      </Link>
    </div>
  );
}
