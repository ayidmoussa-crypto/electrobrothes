import { DateField } from "@/components/ui/DateField";
import { Select } from "@/components/ui/Select";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarRange,
  ChartColumnBig,
  ChartPie,
  ChevronDown,
  ChevronLeft,
  Landmark,
  Lightbulb,
  ListOrdered,
  Megaphone,
  Receipt,
  ShoppingBag,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { addCapital, addExpense, deleteCapital, deleteExpense, markCodReceived } from "@/app/actions/admin-finance";
import { ActionForm } from "@/components/admin/ActionForm";
import { PeriodPicker } from "@/components/admin/PeriodPicker";
import { TrendChart } from "@/components/admin/finance/TrendChart";
import { requireAdmin } from "@/lib/admin";
import { BUSINESS_CATEGORIES, BUSINESS_CATEGORIES_EN, categoryLabel, changePct, expectedFromCarrier, PERSONAL_CATEGORIES, PERSONAL_CATEGORIES_EN } from "@/lib/finance";
import { toFeeOrder } from "@/lib/finance-data";
import { financeCapital, financeLists, financePeriod } from "@/lib/finance-stats";
import { channelLabel } from "@/lib/attribution";
import { formatMAD } from "@/lib/money";
import { periodLabel, resolveAdminPeriod } from "@/lib/period";
import { adminTr, type AdminLang, type Tr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { TIME_ZONE, toMoroccanInput } from "@/lib/time";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("المالية", "Finance");

const shortFmt = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE });
/** The page's language helpers, handed to the small components below. */
type L = { tr: Tr; lang: AdminLang; mad: (v: number) => string };

// Same light look as the rest of the admin: warm off-white cards with a hairline on the white page.
const card = "rounded-3xl bg-warm-50 p-4 ring-1 ring-warm-200 md:p-5";
const field = "min-h-11 w-full rounded-lg border border-warm-200 bg-white px-3 text-base text-warm-800 placeholder:text-warm-400";
const th = "px-3 py-2.5 text-start text-xs font-semibold text-warm-600";
const td = "px-3 py-2.5 align-middle text-sm text-warm-800";
// Slice colours of the sources ring, by rank; literal class names so Tailwind keeps them.
const SLICES = [
  { stroke: "stroke-yellow-500", dot: "bg-yellow-500" },
  { stroke: "stroke-warm-300", dot: "bg-warm-300" },
  { stroke: "stroke-warm-600", dot: "bg-warm-600" },
  { stroke: "stroke-yellow-700", dot: "bg-yellow-700" },
  { stroke: "stroke-warm-400", dot: "bg-warm-400" },
];

function CardTitle({ icon: Icon, children, action }: { icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base text-ink md:text-lg">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-yellow-500">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Up or down against the period before, on a solid chip. */
function Change({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold text-white ${up ? "bg-success" : "bg-danger"}`} dir="ltr">
      {up ? "+" : ""}
      {pct}%
      <Icon className="size-3" aria-hidden="true" />
    </span>
  );
}

type Stage = { label: string; value: number; hint: string; pill: string; pct?: number | null };

/** Where the money sits right now, read left to right like a parcel's path, with the sum set apart. */
function ValueStrip({ stages, total, l }: { stages: Stage[]; total: number; l: L }) {
  const { tr, mad } = l;
  const amount = (v: number) => <span className={`text-lg font-extrabold md:text-xl ${v < 0 ? "text-danger" : ""}`}>{mad(v)}</span>;
  return (
    <section className={card} aria-labelledby="value-title">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="value-title" className="text-xs font-bold tracking-wide text-warm-600">{tr("فين كاينة القيمة ديالك دابا", "Where your value sits now")}</h2>
        <a href="#details" className="text-sm font-bold text-yellow-800 hover:underline">
          {tr("التفاصيل ←", "Details →")}
        </a>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:flex md:items-start">
        {/* Same-width stages with equal dashed links between them, every line touching both pills. */}
        <div className="contents md:flex md:flex-1 md:items-start">
          {stages.map((s, i) => (
            <Fragment key={s.label}>
              {i > 0 ? <span aria-hidden="true" className="mt-7 hidden h-0 min-w-6 flex-1 border-t-2 border-dashed border-warm-300 md:block" /> : null}
              <div className="flex flex-col items-center text-center md:w-44 md:shrink-0">
                <span className={`flex min-h-14 w-full max-w-44 items-center justify-center rounded-full border-2 px-4 text-ink ${s.pill}`}>{amount(s.value)}</span>
                <span className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-sm font-semibold text-ink">
                  {s.label}
                  {s.pct !== undefined ? <Change pct={s.pct} /> : null}
                </span>
                <span className="mt-0.5 text-xs text-warm-600">{s.hint}</span>
              </div>
            </Fragment>
          ))}
        </div>
        <div className="flex flex-col items-center text-center md:ms-6 md:w-52 md:shrink-0 md:border-s md:border-warm-200 md:ps-6">
          <span className="flex min-h-14 w-full max-w-44 items-center justify-center rounded-full border-2 border-ink bg-ink px-4 text-yellow-500">{amount(total)}</span>
          <span className="mt-2 text-sm font-semibold text-ink">{tr("المجموع", "Total")}</span>
          <span className="mt-0.5 text-xs text-warm-600">{tr("السلعة + الربح الصافي", "Goods + net profit")}</span>
        </div>
      </div>
    </section>
  );
}

function Line({ l, label, value, minus, total, hint }: { l: L; label: string; value: number; minus?: boolean; total?: boolean; hint?: string }) {
  const { mad } = l;
  // Nothing to say about an empty line; the totals always stay.
  if (!value && !total) return null;
  return (
    <div className={`flex items-baseline justify-between gap-3 ${total ? "my-2 rounded-xl border-s-4 border-yellow-500 bg-yellow-50 px-4 py-3 text-base font-extrabold" : "border-t border-warm-200 py-2.5"}`}>
      <dt className={total ? "text-ink" : "text-warm-600"}>
        {label}
        {hint ? <span className="block text-xs font-normal text-warm-500">{hint}</span> : null}
      </dt>
      <dd className="shrink-0 text-ink">
        {minus && value ? "− " : ""}
        {mad(value)}
      </dd>
    </div>
  );
}

type SummaryRow = { label: string; value: number; minus?: boolean };

/** The answer first, the few lines behind it next, and the full account one tap away. */
function SummaryCard({ l, icon: Icon, label, value, note, noteBad, rows, children }: { l: L; icon: LucideIcon; label: string; value: number; note?: string; noteBad?: boolean; rows: SummaryRow[]; children: ReactNode }) {
  const { tr, mad } = l;
  const signed = (v: number, minus?: boolean) => (minus || v < 0 ? `− ${mad(Math.abs(v))}` : mad(v));
  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-warm-600">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-yellow-500">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {label}
      </h2>
      <p className={`mt-3 text-3xl font-extrabold ${value < 0 ? "text-danger" : "text-ink"}`}>{signed(value)}</p>
      {note ? <p className={`mt-1 text-sm font-semibold ${noteBad ? "text-danger" : "text-success"}`}>{note}</p> : null}
      <dl className="mt-3 text-sm">
        {rows
          .filter((r) => r.value)
          .map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 border-t border-warm-200 py-2.5">
              <dt className="text-warm-600">{r.label}</dt>
              <dd className={`shrink-0 font-semibold ${r.minus || r.value < 0 ? "text-danger" : "text-ink"}`}>{signed(r.value, r.minus)}</dd>
            </div>
          ))}
      </dl>
      <details className="group border-t border-warm-200">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md text-sm font-bold text-yellow-800 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">{tr("شوف التفاصيل", "Show details")}</span>
          <span className="hidden group-open:inline">{tr("خبي التفاصيل", "Hide details")}</span>
          <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <dl className="text-sm">{children}</dl>
      </details>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-warm-600">
      {label}
      {children}
    </label>
  );
}

function DeleteButton({ action, id, label }: { action: (fd: FormData) => Promise<void>; id: string; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={label} className="grid size-11 cursor-pointer place-items-center rounded-lg text-warm-600 transition-colors hover:bg-warm-100 hover:text-danger">
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

/** Revenue share of each channel the buyers came from, as a ring. */
function SourcesRing({ sources, l }: { sources: { channel: string; revenue: number; orders: number }[]; l: L }) {
  const { tr, lang } = l;
  const total = sources.reduce((s, x) => s + x.revenue, 0);
  if (!total) return <p className="py-10 text-center text-sm text-warm-600">{tr("ما تسلم حتى طلب فهاد الفترة.", "No order was delivered in this period.")}</p>;
  const R = 52;
  const C = 2 * Math.PI * R;
  // Five slices at most: the rest is grouped.
  const rest = sources.slice(4);
  const shown = rest.length > 1 ? [...sources.slice(0, 4), { channel: "REST", revenue: rest.reduce((s, x) => s + x.revenue, 0), orders: rest.reduce((s, x) => s + x.orders, 0) }] : sources;
  const name = (c: string) => (c === "REST" ? tr("الباقي", "Rest") : channelLabel(c || null, lang));
  const lens = shown.map((s) => (s.revenue / total) * C);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  const pct = (v: number) => Math.round((v / total) * 100);
  return (
    <div>
      <div className="relative mx-auto size-44">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="70" cy="70" r={R} fill="none" className="stroke-warm-100" strokeWidth="20" />
          {shown.map((s, i) => (
            <circle key={s.channel} cx="70" cy="70" r={R} fill="none" className={SLICES[i].stroke} strokeWidth="20" strokeDasharray={`${lens[i]} ${C - lens[i]}`} strokeDashoffset={-starts[i]} />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <p className="text-3xl font-extrabold text-ink">{pct(shown[0].revenue)}%</p>
          <p className="max-w-24 text-xs text-warm-600">{name(shown[0].channel)}</p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {shown.map((s, i) => (
          <li key={s.channel} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-warm-700">
              <span className={`size-2.5 shrink-0 rounded-full ${SLICES[i].dot}`} aria-hidden="true" />
              {name(s.channel)}
              <span className="text-xs text-warm-500">({s.orders})</span>
            </span>
            <span className="font-bold text-ink">{pct(s.revenue)}%</span>
          </li>
        ))}
      </ul>
      <Link href="/admin/settings#tracking" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink underline-offset-4 hover:underline">
        {tr("روابط التتبع لإنستغرام وتيك توك", "Tracking links for Instagram and TikTok")}
        <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default async function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const mad = (v: number) => formatMAD(v, lang);
  const l: L = { tr, lang, mad };
  const dayFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeZone: TIME_ZONE });
  const period = resolveAdminPeriod(await searchParams);
  const span = periodLabel(period, lang);

  // Cached for two minutes and expired by any order, stock or money change (lib/finance-stats.ts).
  const [{ profit: p, trend, sources, before }, c, { uncollected, expenses, capitalEntries, received }] = await Promise.all([
    financePeriod(period.from.getTime(), period.until.getTime(), period.days, period.prevFrom.getTime()),
    financeCapital(),
    financeLists(),
  ]);

  const today = toMoroccanInput(new Date(), 10);
  const gaps = [
    p.gaps.unitsWithoutCost ? tr(`${p.gaps.unitsWithoutCost} قطعة مبيوعة بلا ثمن شراء: الربح الحقيقي أقل من الرقم اللي هنا. زيد ثمن الشراء فصفحة المنتج.`, `${p.gaps.unitsWithoutCost} sold units have no purchase price: the real profit is lower than shown. Add the purchase price on the product page.`) : null,
    p.gaps.deliveredWithoutFee ? tr(`${p.gaps.deliveredWithoutFee} طلب مسلَّم بلا رسوم توصيل. حدد ثمن التوصيل ديال المدينة فـ«المدن والتوصيل» ولا الرسوم فالطلب.`, `${p.gaps.deliveredWithoutFee} delivered orders have no delivery fee. Set the city's delivery price in “Cities & delivery” or the fee on the order.`) : null,
    c.gaps.unitsWithoutCost ? tr(`${c.gaps.unitsWithoutCost} قطعة فالمخزون بلا ثمن شراء: قيمة المخزون ناقصة.`, `${c.gaps.unitsWithoutCost} units in stock have no purchase price: the stock value is short.`) : null,
    c.gaps.movesWithoutCost ? tr(`${c.gaps.movesWithoutCost} قطعة دخلات للمخزون بلا ثمن شراء: الكاش ورأس المال ما كيحسبوش ثمنها.`, `${c.gaps.movesWithoutCost} units came into stock without a purchase price: cash and capital leave out their cost.`) : null,
    c.hiddenUnits ? tr(`${c.hiddenUnits} قطعة ديال منتجات مخبية من المتجر ما داخلاش فالحساب. إلا كان شي منتج مخبي وشريتيه بصح، ظهّرو باش يتحسب.`, `${c.hiddenUnits} units of products hidden from the shop are not counted. If you really bought a hidden product, show it so it counts.`) : null,
  ].filter((g): g is string => Boolean(g));

  // Every movement of money, newest first: carrier transfers, expenses, money put in or taken out.
  const moves = [
    ...received.map((o) => ({ id: `o${o.id}`, in: true, kind: tr("تحويل التوصيل", "Carrier transfer"), amount: o.codReceivedAmount ?? 0, at: o.codReceivedAt!, note: o.number, href: `/admin/orders/${o.id}` })),
    ...expenses.map((e) => ({ id: `e${e.id}`, in: false, kind: e.scope === "PERSONAL" ? tr("مصروف شخصي", "Personal expense") : tr("مصروف المشروع", "Business expense"), amount: e.amount, at: e.spentOn, note: [categoryLabel(e.scope, e.category, lang), e.note].filter(Boolean).join(" · "), href: undefined })),
    ...capitalEntries.map((e) => ({ id: `c${e.id}`, in: e.type === "INJECTION", kind: e.type === "INJECTION" ? tr("دخلت فلوس", "Money in") : tr("سحبت فلوس", "Money out"), amount: e.amount, at: e.occurredOn, note: e.note ?? "", href: undefined })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  const revenueChange = changePct(p.revenue, before.revenue);
  const netChange = before.netProfit > 0 ? changePct(p.netProfit, before.netProfit) : null;
  const insight = !p.deliveredCount
    ? tr(`ما تسلم حتى طلب فـ ${span}.`, `No order was delivered in ${span}.`)
    : revenueChange === null
      ? tr(`المبيعات المسلَّمة فـ ${span} هي ${mad(p.revenue)}، وما كاين حتى بيع فالفترة اللي قبلها باش نقارنو.`, `Delivered sales in ${span} are ${mad(p.revenue)}, with no sales in the period before to compare with.`)
      : tr(
          `المبيعات المسلَّمة فـ ${span} هي ${mad(p.revenue)}، ${revenueChange >= 0 ? "زايدة" : "ناقصة"} ب ${Math.abs(revenueChange)}% على نفس المدة اللي قبلها.`,
          `Delivered sales in ${span} are ${mad(p.revenue)}, ${revenueChange >= 0 ? "up" : "down"} ${Math.abs(revenueChange)}% on the same length of time before.`,
        );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl text-ink md:text-3xl">{tr("المالية", "Finance")}</h1>
          <p className="mt-1 text-sm text-warm-600">
            {tr(`الأرباح على ${span}، ورأس المال من البداية.`, `Profit over ${span}, and capital since the start.`)}
          </p>
        </div>
        {/* Keyed by the period, so its panel starts closed after every choice. */}
        <PeriodPicker key={period.query} basePath="/admin/finance" preset={period.preset} firstDay={period.firstDay} lastDay={period.lastDay} today={today} lang={lang} label={tr("الفترة", "Period")} />
      </div>

      {gaps.length ? (
        <details className="mb-5 rounded-2xl bg-warning-soft p-4 text-sm text-warning-text">
          <summary className="flex cursor-pointer items-center gap-2 font-bold">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            {tr(`${gaps.length} ديال الأرقام ناقصة وكتأثر على الحساب`, `${gaps.length} missing figures affect the numbers`)}
          </summary>
          <ul className="mt-2 list-inside list-disc">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <ValueStrip
        l={l}
        stages={[
          { label: tr("السلعة فالمخزون", "Goods in stock"), value: c.inventoryValue, hint: tr("رأس مال السلعة بثمن الشراء", "Stock capital at purchase price"), pill: "border-ink bg-white" },
          { label: tr("السلعة فالطريق", "Goods on the way"), value: c.goodsInTransit, hint: tr(`خارجة ${mad(c.goodsInTransit - c.goodsReturning)} · راجعة ليك ${mad(c.goodsReturning)}`, `Going out ${mad(c.goodsInTransit - c.goodsReturning)} · coming back ${mad(c.goodsReturning)}`), pill: "border-yellow-500 bg-yellow-50" },
          {
            label: tr(`صافي الربح · ${span}`, `Net profit · ${span}`),
            value: p.netProfit,
            pct: netChange,
            hint: p.margin === null ? tr("ما كاين حتى بيع", "No sales") : tr(`الهامش ${p.margin}%`, `Margin ${p.margin}%`),
            pill: p.netProfit < 0 ? "border-danger bg-danger-soft" : "border-success bg-success-soft",
          },
        ]}
        total={c.inventoryValue + c.goodsInTransit + p.netProfit}
      />

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className={card} aria-labelledby="trend-sales-title">
          <CardTitle icon={ChartColumnBig}>
            <span id="trend-sales-title">{tr(`تطور المبيعات المسلَّمة · ${span}`, `Delivered sales · ${span}`)}</span>
          </CardTitle>
          <TrendChart data={trend} metric="revenue" label={tr("المبيعات المسلَّمة", "Delivered sales")} total={p.revenue} />
        </section>
        <section className={card} aria-labelledby="trend-net-title">
          <CardTitle icon={p.netProfit < 0 ? TrendingDown : TrendingUp}>
            <span id="trend-net-title">{tr(`تطور صافي الربح · ${span}`, `Net profit · ${span}`)}</span>
          </CardTitle>
          <TrendChart data={trend} metric="net" label={tr("صافي الربح", "Net profit")} total={p.netProfit} />
        </section>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className={`${card} lg:order-2`} aria-labelledby="sources-title">
          <CardTitle icon={ChartPie}>
            <span id="sources-title">{tr("مصادر المبيعات", "Sales sources")}</span>
          </CardTitle>
          <SourcesRing sources={sources} l={l} />
        </section>

        <section className={`${card} lg:order-1`} aria-labelledby="period-title">
          <CardTitle icon={CalendarRange}>
            <span id="period-title">{tr("أداء الفترة الحالية", "This period")}</span>
          </CardTitle>
          <dl className="flex flex-col divide-y divide-warm-200 text-sm">
            {[
              { icon: ShoppingBag, label: tr("المبيعات المسلَّمة", "Delivered sales"), value: mad(p.revenue) },
              { icon: TrendingUp, label: tr("الربح الخام", "Gross profit"), value: mad(p.grossProfit) },
              { icon: Tag, label: tr("متوسط الصافي لكل طلب", "Average net per order"), value: p.perOrder === null ? "—" : mad(p.perOrder) },
              { icon: ListOrdered, label: tr("الطلبات المسلَّمة", "Delivered orders"), value: String(p.deliveredCount) },
              { icon: Undo2, label: tr("الطلبات الراجعة", "Returned orders"), value: String(p.returnedCount) },
              { icon: Megaphone, label: tr("الإعلان لكل طلب مسلَّم", "Ad cost per delivered order"), value: p.costPerDelivered === null ? "—" : mad(p.costPerDelivered) },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="flex items-center gap-2 text-warm-700">
                  <r.icon className="size-4 shrink-0 text-warm-500" aria-hidden="true" />
                  {r.label}
                </dt>
                <dd className="font-bold text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section className="flex min-w-0 flex-col justify-between gap-4 rounded-3xl bg-yellow-50 p-5 ring-1 ring-yellow-300" aria-labelledby="insight-title">
          <div>
            <h2 id="insight-title" className="flex items-center gap-2 text-lg text-ink">
              <Lightbulb className="size-5 text-yellow-800" aria-hidden="true" />
              {tr("معلومة مهمة", "Worth knowing")}
            </h2>
            <p className="mt-3 leading-relaxed text-warm-700">{insight}</p>
          </div>
          <a href="#details" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-yellow-500 px-5 font-extrabold text-ink transition-colors hover:bg-yellow-600 active:bg-yellow-700">
            <ChartColumnBig className="size-4" aria-hidden="true" />
            {tr("عرض التفاصيل الكاملة", "See the full details")}
          </a>
        </section>

        <section className={`${card} min-w-0 lg:col-span-2`} aria-labelledby="moves-title">
          <CardTitle icon={Receipt}>
            <span id="moves-title">{tr("أحدث المعاملات", "Latest transactions")}</span>
          </CardTitle>
          {moves.length ? (
            <div className="overflow-x-auto rounded-2xl ring-1 ring-warm-200">
              <table className="w-full min-w-[34rem]">
                <thead className="bg-warm-100">
                  <tr>
                    <th className={th}>{tr("النوع", "Type")}</th>
                    <th className={th}>{tr("المبلغ", "Amount")}</th>
                    <th className={th}>{tr("التاريخ", "Date")}</th>
                    <th className={th}>{tr("ملاحظات", "Notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id} className="border-t border-warm-200 bg-white">
                      <td className={td}>
                        <span className="flex items-center gap-2">
                          <span className={`grid size-6 shrink-0 place-items-center rounded-full text-white ${m.in ? "bg-success" : "bg-danger"}`}>
                            {m.in ? <ArrowUp className="size-3.5" aria-label={tr("داخل", "In")} /> : <ArrowDown className="size-3.5" aria-label={tr("خارج", "Out")} />}
                          </span>
                          {m.kind}
                        </span>
                      </td>
                      <td className={`${td} font-bold`}>
                        <span dir="ltr">{m.in ? "+" : "−"}</span>
                        {mad(m.amount)}
                      </td>
                      <td className={`${td} text-warm-600`} dir="ltr">
                        {shortFmt.format(m.at)}
                      </td>
                      <td className={`${td} max-w-56 truncate text-warm-600`}>
                        {m.href ? (
                          <Link href={m.href} className="font-mono text-ink underline-offset-4 hover:underline" dir="ltr">
                            {m.note}
                          </Link>
                        ) : (
                          m.note || "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-warm-600">{tr("مازال ما كاين حتى معاملة: تحويلات التوصيل، المصاريف وحركات رأس المال كيبانو هنا.", "No transactions yet: carrier transfers, expenses and capital moves show here.")}</p>
          )}
          <a href="#records" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink underline-offset-4 hover:underline">
            {tr("كل المصاريف وحركات رأس المال", "All expenses and capital moves")}
            <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
          </a>
        </section>
      </div>

      <div id="details" className="mt-3 grid scroll-mt-28 gap-3 lg:grid-cols-2 lg:items-start">
        <SummaryCard
          l={l}
          icon={p.netProfit < 0 ? TrendingDown : TrendingUp}
          label={tr(`صافي الربح · ${span}`, `Net profit · ${span}`)}
          value={p.netProfit}
          note={p.margin === null ? undefined : tr(`الهامش ${p.margin}%`, `Margin ${p.margin}%`)}
          noteBad={p.netProfit < 0}
          rows={[
            { label: tr("المبيعات المسلَّمة", "Delivered sales"), value: p.revenue },
            { label: tr("السلعة", "Goods"), value: p.cogs, minus: true },
            // Whatever else stands between the sales and the net profit, so the three lines always add up.
            { label: tr("التوصيل والمصاريف", "Delivery and expenses"), value: p.revenue - p.cogs - p.netProfit, minus: true },
          ]}
        >
            <Line l={l} label={tr("المبيعات المسلَّمة", "Delivered sales")} value={p.revenue} />
            <Line l={l} label={tr("تكلفة السلعة", "Cost of goods")} value={p.cogs} minus />
            <Line l={l} label={tr("رسوم التوصيل", "Delivery fees")} value={p.deliveryCost} minus hint={tr("ثمن المدينة على الطلبات اللي التوصيل فيها مجاني ولا خلصو الزبون.", "The city price on orders with free delivery or paid by the customer.")} />
            <Line l={l} label={tr("الربح الخام", "Gross profit")} value={p.grossProfit} total />
            <Line l={l} label={tr("رسوم الطرود الراجعة", "Returned parcel fees")} value={p.returnsCost} minus hint={tr("الطرد الراجع ما كتخلص عليه والو، والسلعة كترجع للمخزون. غير إلا كتبتي رسوم فالطلب.", "A returned parcel costs nothing and its goods go back to stock, unless you typed a fee on the order.")} />
            <Line l={l} label={tr("مصاريف المشروع", "Business expenses")} value={p.businessExpenses} minus />
            <Line l={l} label={tr("نقص فالمخزون", "Stock loss")} value={p.stockLoss} minus hint={tr("التعديلات بالناقص من صفحة المنتج.", "Downward corrections from the product page.")} />
            <Line l={l} label={tr("صافي الربح", "Net profit")} value={p.netProfit} total />
            <Line l={l} label={tr("مصاريفك الشخصية", "Your personal spending")} value={p.personalExpenses} minus />
            {p.personalExpenses ? <Line l={l} label={tr("اللي بقا بعد مصاريفك", "Left after your spending")} value={p.afterPersonal} total /> : null}
        </SummaryCard>

        <SummaryCard
          l={l}
          icon={Landmark}
          label={tr("رأس المال ديالك اليوم", "Your capital today")}
          value={c.position}
          note={tr(
            `${c.result < 0 ? "خسارة" : "ربح"} ${mad(Math.abs(c.result))} منذ البداية${c.resultPct === null ? "" : ` · ${Math.abs(c.resultPct)}%`}`,
            `${c.result < 0 ? "Loss" : "Profit"} of ${mad(Math.abs(c.result))} since the start${c.resultPct === null ? "" : ` · ${Math.abs(c.resultPct)}%`}`,
          )}
          noteBad={c.result < 0}
          rows={[
            { label: tr("السلعة فالمخزون", "Goods in stock"), value: c.inventoryValue },
            { label: tr("السلعة فالطريق", "Goods on the way"), value: c.goodsInTransit },
            { label: tr("عند شركة التوصيل", "Held by the carrier"), value: c.owedByCarrier },
            { label: tr("الكاش", "Cash"), value: c.cash },
          ]}
        >
            <Line l={l} label={tr("الكاش", "Cash")} value={c.cash} hint={tr("اللي دخلتي + تحويلات التوصيل − المشتريات − كل المصاريف", "Money put in + carrier transfers − purchases − all expenses")} />
            <Line l={l} label={tr("السلعة فالمخزون", "Goods in stock")} value={c.inventoryValue} hint={tr("بثمن الشراء", "At purchase price")} />
            <Line l={l} label={tr("سلعة فالطريق", "Goods on the way")} value={c.goodsInTransit} hint={tr(`طلبات مأكدة ولا فالشحن، والسلعة المرفوضة اللي راجعة ليك (${mad(c.goodsReturning)}). بثمن الشراء.`, `Confirmed or shipping orders, and refused goods coming back to you (${mad(c.goodsReturning)}). At purchase price.`)} />
            <Line l={l} label={tr("فلوس عند شركة التوصيل", "Money held by the carrier")} value={c.owedByCarrier} hint={tr("طلبات تسلمات للزبون، والفلوس مازال ما حولتهاش ليك الشركة. بثمن البيع ناقص الرسوم.", "Orders delivered to the customer that the carrier has not paid you yet. Sale price minus fees.")} />
            <Line l={l} label={tr("المجموع اليوم", "Total today")} value={c.position} total />
            <Line l={l} label={tr("اللي استثمرتي", "Invested")} value={c.invested} hint={tr(`دخلتي ${mad(c.injections)} + سلعة البداية ${mad(c.openingStockValue)} − سحبتي ${mad(c.withdrawals)}`, `Put in ${mad(c.injections)} + opening stock ${mad(c.openingStockValue)} − taken out ${mad(c.withdrawals)}`)} />
            <Line l={l} label={c.result < 0 ? tr("الخسارة منذ البداية", "Loss since the start") : tr("الربح منذ البداية", "Profit since the start")} value={c.result} total hint={c.resultPct === null ? undefined : tr(`${c.resultPct}% من اللي استثمرتي، والمصاريف الشخصية محسوبة`, `${c.resultPct}% of what you invested, personal spending included`)} />
        </SummaryCard>
      </div>

      <section className={`${card} mt-3`} aria-labelledby="cod-title">
        <CardTitle icon={Receipt}>
          <span id="cod-title">{tr(`عند شركة التوصيل (${uncollected.length})`, `Held by the carrier (${uncollected.length})`)}</span>
        </CardTitle>
        {uncollected.length ? (
          <ActionForm action={markCodReceived} submitLabel={tr("توصلت بالطلبات المحددة", "Mark selected as received")} className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-2xl ring-1 ring-warm-200">
              <table className="w-full min-w-[36rem]">
                <thead className="bg-warm-100">
                  <tr>
                    <th className={th}>
                      <span className="sr-only">{tr("اختيار", "Select")}</span>
                    </th>
                    <th className={th}>{tr("الطلب", "Order")}</th>
                    <th className={th}>{tr("الزبون", "Customer")}</th>
                    <th className={th}>{tr("تسلّم", "Delivered")}</th>
                    <th className={th}>{tr("المنتظر", "Expected")}</th>
                  </tr>
                </thead>
                <tbody>
                  {uncollected.map((o) => (
                    <tr key={o.id} className="border-t border-warm-200 bg-white">
                      <td className={td}>
                        <input type="checkbox" name="orderId" value={o.id} aria-label={tr(`اختيار ${o.number}`, `Select ${o.number}`)} className="size-5 accent-yellow-500" />
                      </td>
                      <td className={td}>
                        <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold text-ink underline-offset-4 hover:underline" dir="ltr">
                          {o.number}
                        </Link>
                      </td>
                      <td className={td}>{o.customerName}</td>
                      <td className={`${td} text-warm-600`}>{o.deliveredAt ? dayFmt.format(o.deliveredAt) : "—"}</td>
                      <td className={`${td} font-bold`}>{mad(expectedFromCarrier(toFeeOrder(o)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-warm-600">{tr("المنتظر هو المبلغ ناقص رسوم التوصيل. إلا توصلتي بمبلغ آخر، سجلو من صفحة الطلب.", "Expected is the amount minus the delivery fee. If you received another amount, record it on the order page.")}</p>
          </ActionForm>
        ) : (
          <p className="text-sm text-warm-600">{tr("ما كاين حتى طلب مسلَّم كيتسنى التحويل.", "No delivered order is waiting for a transfer.")}</p>
        )}
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {(
          [
            { scope: "BUSINESS", title: tr("مصروف ديال المشروع", "Business expense"), categories: lang === "en" ? BUSINESS_CATEGORIES_EN : BUSINESS_CATEGORIES, note: undefined },
            {
              scope: "PERSONAL",
              title: tr("مصروف ولا خسارة شخصية", "Personal expense or loss"),
              categories: lang === "en" ? PERSONAL_CATEGORIES_EN : PERSONAL_CATEGORIES,
              note: tr("ما كيدخلش فربح المشروع، ولكن كينقص من الكاش ومن نتيجة رأس المال.", "Not counted in business profit, but it lowers cash and the capital result."),
            },
          ]
        ).map((f) => (
          <section key={f.scope} className={card}>
            <h2 className="mb-3 text-base text-ink">{f.title}</h2>
            <ActionForm action={addExpense} submitLabel={tr("إضافة", "Add")}>
              <input type="hidden" name="scope" value={f.scope} />
              <Field label={tr("النوع", "Type")}>
                <Select name="category" className={field}>
                  {Object.entries(f.categories).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tr("المبلغ (درهم)", "Amount (MAD)")}>
                <input name="amount" type="number" min={1} required className={field} />
              </Field>
              <Field label={tr("التاريخ", "Date")}>
                <DateField name="spentOn" required defaultValue={today} className={field} lang={lang} />
              </Field>
              <Field label={tr("ملاحظة", "Note")}>
                <input name="note" maxLength={200} className={field} />
              </Field>
            </ActionForm>
            {f.note ? <p className="mt-3 text-xs text-warm-600">{f.note}</p> : null}
          </section>
        ))}

        <section className={card}>
          <h2 className="mb-3 text-base text-ink">{tr("حركة رأس المال", "Capital move")}</h2>
          <ActionForm action={addCapital} submitLabel={tr("إضافة", "Add")}>
            <Field label={tr("النوع", "Type")}>
              <Select name="type" className={field}>
                <option value="INJECTION">{tr("دخلت فلوس للمشروع", "Money put into the business")}</option>
                <option value="WITHDRAWAL">{tr("سحبت فلوس من المشروع", "Money taken out of the business")}</option>
              </Select>
            </Field>
            <Field label={tr("المبلغ (درهم)", "Amount (MAD)")}>
              <input name="amount" type="number" min={1} required className={field} />
            </Field>
            <Field label={tr("التاريخ", "Date")}>
              <DateField name="occurredOn" required defaultValue={today} className={field} lang={lang} />
            </Field>
            <Field label={tr("ملاحظة", "Note")}>
              <input name="note" maxLength={200} className={field} />
            </Field>
          </ActionForm>
        </section>
      </div>

      <div id="records" className="mt-3 grid scroll-mt-28 gap-3 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-3 text-base text-ink">{tr("آخر المصاريف", "Latest expenses")}</h2>
          {expenses.length ? (
            <ul className="flex flex-col divide-y divide-warm-200 text-sm">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">
                      {categoryLabel(e.scope, e.category, lang)}
                      <span className="ms-2 rounded-md bg-warm-100 px-1.5 py-0.5 text-xs font-normal text-warm-700">{e.scope === "PERSONAL" ? tr("شخصي", "Personal") : tr("المشروع", "Business")}</span>
                    </span>
                    <span className="block truncate text-xs text-warm-600">
                      {dayFmt.format(e.spentOn)}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <b className="text-ink">{mad(e.amount)}</b>
                    <DeleteButton action={deleteExpense} id={e.id} label={tr("حذف المصروف", "Delete expense")} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-600">{tr("مازال ما تسجل حتى مصروف.", "No expense recorded yet.")}</p>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-3 text-base text-ink">{tr("حركات رأس المال", "Capital moves")}</h2>
          {capitalEntries.length ? (
            <ul className="flex flex-col divide-y divide-warm-200 text-sm">
              {capitalEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{e.type === "INJECTION" ? tr("دخلت فلوس", "Money in") : tr("سحبت فلوس", "Money out")}</span>
                    <span className="block truncate text-xs text-warm-600">
                      {dayFmt.format(e.occurredOn)}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <b className="text-ink">
                      <span dir="ltr">{e.type === "INJECTION" ? "+" : "−"}</span>
                      {mad(e.amount)}
                    </b>
                    <DeleteButton action={deleteCapital} id={e.id} label={tr("حذف الحركة", "Delete move")} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-600">{tr("سجل شحال دخلتي فالمشروع باش يتحسب رأس المال بالصح.", "Record how much you put into the business so capital is counted right.")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
