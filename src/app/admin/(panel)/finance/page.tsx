import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarRange,
  ChartColumnBig,
  ChartPie,
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
import { TrendChart } from "@/components/admin/finance/TrendChart";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { BUSINESS_CATEGORIES, categoryLabel, changePct, expectedFromCarrier, PERSONAL_CATEGORIES } from "@/lib/finance";
import { feeFields, loadCapital, loadPeriod, toFeeOrder } from "@/lib/finance-data";
import { channelLabel } from "@/lib/attribution";
import { formatMAD } from "@/lib/money";
import { TIME_ZONE, toMoroccanInput } from "@/lib/time";

const RANGES = [7, 30, 90, 365] as const;
const dayFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeZone: TIME_ZONE });
const shortFmt = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE });
const mad = (v: number) => formatMAD(v, "ar");

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
function ValueStrip({ stages, total }: { stages: Stage[]; total: number }) {
  const amount = (v: number) => <span className={`text-lg font-extrabold md:text-xl ${v < 0 ? "text-danger" : ""}`}>{mad(v)}</span>;
  return (
    <section className={card} aria-labelledby="value-title">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="value-title" className="text-xs font-bold tracking-wide text-warm-600">فين كاينة القيمة ديالك دابا</h2>
        <a href="#details" className="text-sm font-bold text-yellow-800 hover:underline">
          التفاصيل ←
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
          <span className="mt-2 text-sm font-semibold text-ink">المجموع</span>
          <span className="mt-0.5 text-xs text-warm-600">السلعة + الربح الصافي</span>
        </div>
      </div>
    </section>
  );
}

function Line({ label, value, minus, total, hint }: { label: string; value: number; minus?: boolean; total?: boolean; hint?: string }) {
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
function SourcesRing({ sources }: { sources: { channel: string; revenue: number; orders: number }[] }) {
  const total = sources.reduce((s, x) => s + x.revenue, 0);
  if (!total) return <p className="py-10 text-center text-sm text-warm-600">ما تسلم حتى طلب فهاد الفترة.</p>;
  const R = 52;
  const C = 2 * Math.PI * R;
  // Five slices at most: the rest is grouped.
  const rest = sources.slice(4);
  const shown = rest.length > 1 ? [...sources.slice(0, 4), { channel: "REST", revenue: rest.reduce((s, x) => s + x.revenue, 0), orders: rest.reduce((s, x) => s + x.orders, 0) }] : sources;
  const name = (c: string) => (c === "REST" ? "الباقي" : channelLabel(c || null));
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
        روابط التتبع لإنستغرام وتيك توك
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default async function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  await requireAdmin();
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;

  const [{ profit: p, trend, sources, before }, c, uncollected, expenses, capitalEntries, received] = await Promise.all([
    loadPeriod(days),
    loadCapital(),
    db.order.findMany({
      where: { status: "DELIVERED", codReceivedAt: null },
      orderBy: { deliveredAt: "asc" },
      take: 100,
      select: { id: true, number: true, customerName: true, deliveredAt: true, ...feeFields },
    }),
    db.expense.findMany({ orderBy: { spentOn: "desc" }, take: 40 }),
    db.capitalEntry.findMany({ orderBy: { occurredOn: "desc" }, take: 20 }),
    db.order.findMany({
      where: { codReceivedAt: { not: null } },
      orderBy: { codReceivedAt: "desc" },
      take: 8,
      select: { id: true, number: true, codReceivedAt: true, codReceivedAmount: true },
    }),
  ]);

  const today = toMoroccanInput(new Date(), 10);
  const gaps = [
    p.gaps.unitsWithoutCost ? `${p.gaps.unitsWithoutCost} قطعة مبيوعة بلا ثمن شراء: الربح الحقيقي أقل من الرقم اللي هنا. زيد ثمن الشراء فصفحة المنتج.` : null,
    p.gaps.deliveredWithoutFee ? `${p.gaps.deliveredWithoutFee} طلب مسلَّم بلا رسوم توصيل. حدد ثمن التوصيل ديال المدينة فـ«المدن والتوصيل» ولا الرسوم فالطلب.` : null,
    c.gaps.unitsWithoutCost ? `${c.gaps.unitsWithoutCost} قطعة فالمخزون بلا ثمن شراء: قيمة المخزون ناقصة.` : null,
    c.gaps.movesWithoutCost ? `${c.gaps.movesWithoutCost} قطعة دخلات للمخزون بلا ثمن شراء: الكاش ورأس المال ما كيحسبوش ثمنها.` : null,
    c.hiddenUnits ? `${c.hiddenUnits} قطعة ديال منتجات مخبية من المتجر ما داخلاش فالحساب. إلا كان شي منتج مخبي وشريتيه بصح، ظهّرو باش يتحسب.` : null,
  ].filter((g): g is string => Boolean(g));

  // Every movement of money, newest first: carrier transfers, expenses, money put in or taken out.
  const moves = [
    ...received.map((o) => ({ id: `o${o.id}`, in: true, kind: "تحويل التوصيل", amount: o.codReceivedAmount ?? 0, at: o.codReceivedAt!, note: o.number, href: `/admin/orders/${o.id}` })),
    ...expenses.map((e) => ({ id: `e${e.id}`, in: false, kind: e.scope === "PERSONAL" ? "مصروف شخصي" : "مصروف المشروع", amount: e.amount, at: e.spentOn, note: [categoryLabel(e.scope, e.category), e.note].filter(Boolean).join(" · "), href: undefined })),
    ...capitalEntries.map((e) => ({ id: `c${e.id}`, in: e.type === "INJECTION", kind: e.type === "INJECTION" ? "دخلت فلوس" : "سحبت فلوس", amount: e.amount, at: e.occurredOn, note: e.note ?? "", href: undefined })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  const revenueChange = changePct(p.revenue, before.revenue);
  const netChange = before.netProfit > 0 ? changePct(p.netProfit, before.netProfit) : null;
  const insight = !p.deliveredCount
    ? `ما تسلم حتى طلب فآخر ${days} يوم.`
    : revenueChange === null
      ? `المبيعات المسلَّمة فآخر ${days} يوم هي ${mad(p.revenue)}، وما كاين حتى بيع فالفترة اللي قبلها باش نقارنو.`
      : `المبيعات المسلَّمة فآخر ${days} يوم هي ${mad(p.revenue)}، ${revenueChange >= 0 ? "زايدة" : "ناقصة"} ب ${Math.abs(revenueChange)}% على ${days} يوم اللي قبلها.`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl text-ink md:text-3xl">المالية</h1>
          <p className="mt-1 text-sm text-warm-600">
            الأرباح على آخر {days} يوم، ورأس المال من البداية.
          </p>
        </div>
        <nav aria-label="الفترة" className="flex flex-wrap gap-1 rounded-full bg-warm-100 p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/finance?days=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${r === days ? "bg-ink text-white" : "text-warm-700 hover:text-ink"}`}
            >
              {r} يوم
            </Link>
          ))}
        </nav>
      </div>

      {gaps.length ? (
        <details className="mb-5 rounded-2xl bg-warning-soft p-4 text-sm text-warning-text">
          <summary className="flex cursor-pointer items-center gap-2 font-bold">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            {gaps.length} ديال الأرقام ناقصة وكتأثر على الحساب
          </summary>
          <ul className="mt-2 list-inside list-disc">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <ValueStrip
        stages={[
          { label: "السلعة فالمخزون", value: c.inventoryValue, hint: "رأس مال السلعة بثمن الشراء", pill: "border-ink bg-white" },
          { label: "السلعة فالطريق", value: c.goodsInTransit, hint: "خرجات وجاري التسليم", pill: "border-yellow-500 bg-yellow-50" },
          {
            label: `صافي الربح · ${days} يوم`,
            value: p.netProfit,
            pct: netChange,
            hint: p.margin === null ? "ما كاين حتى بيع" : `الهامش ${p.margin}%`,
            pill: p.netProfit < 0 ? "border-danger bg-danger-soft" : "border-success bg-success-soft",
          },
        ]}
        total={c.inventoryValue + c.goodsInTransit + p.netProfit}
      />

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className={card} aria-labelledby="trend-sales-title">
          <CardTitle icon={ChartColumnBig}>
            <span id="trend-sales-title">تطور المبيعات المسلَّمة · آخر {days} يوم</span>
          </CardTitle>
          <TrendChart data={trend} metric="revenue" label="المبيعات المسلَّمة" total={p.revenue} />
        </section>
        <section className={card} aria-labelledby="trend-net-title">
          <CardTitle icon={p.netProfit < 0 ? TrendingDown : TrendingUp}>
            <span id="trend-net-title">تطور صافي الربح · آخر {days} يوم</span>
          </CardTitle>
          <TrendChart data={trend} metric="net" label="صافي الربح" total={p.netProfit} />
        </section>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className={`${card} lg:order-2`} aria-labelledby="sources-title">
          <CardTitle icon={ChartPie}>
            <span id="sources-title">مصادر المبيعات</span>
          </CardTitle>
          <SourcesRing sources={sources} />
        </section>

        <section className={`${card} lg:order-1`} aria-labelledby="period-title">
          <CardTitle icon={CalendarRange}>
            <span id="period-title">أداء الفترة الحالية</span>
          </CardTitle>
          <dl className="flex flex-col divide-y divide-warm-200 text-sm">
            {[
              { icon: ShoppingBag, label: "المبيعات المسلَّمة", value: mad(p.revenue) },
              { icon: TrendingUp, label: "الربح الخام", value: mad(p.grossProfit) },
              { icon: Tag, label: "متوسط الصافي لكل طلب", value: p.perOrder === null ? "—" : mad(p.perOrder) },
              { icon: ListOrdered, label: "الطلبات المسلَّمة", value: String(p.deliveredCount) },
              { icon: Undo2, label: "الطلبات الراجعة", value: String(p.returnedCount) },
              { icon: Megaphone, label: "الإعلان لكل طلب مسلَّم", value: p.costPerDelivered === null ? "—" : mad(p.costPerDelivered) },
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

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <section className="flex flex-col justify-between gap-4 rounded-3xl bg-yellow-50 p-5 ring-1 ring-yellow-300" aria-labelledby="insight-title">
          <div>
            <h2 id="insight-title" className="flex items-center gap-2 text-lg text-ink">
              <Lightbulb className="size-5 text-yellow-800" aria-hidden="true" />
              معلومة مهمة
            </h2>
            <p className="mt-3 leading-relaxed text-warm-700">{insight}</p>
          </div>
          <a href="#details" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-yellow-500 px-5 font-extrabold text-ink transition-colors hover:bg-yellow-600 active:bg-yellow-700">
            <ChartColumnBig className="size-4" aria-hidden="true" />
            عرض التفاصيل الكاملة
          </a>
        </section>

        <section className={`${card} lg:col-span-2`} aria-labelledby="moves-title">
          <CardTitle icon={Receipt}>
            <span id="moves-title">أحدث المعاملات</span>
          </CardTitle>
          {moves.length ? (
            <div className="overflow-x-auto rounded-2xl ring-1 ring-warm-200">
              <table className="w-full min-w-[34rem]">
                <thead className="bg-warm-100">
                  <tr>
                    <th className={th}>النوع</th>
                    <th className={th}>المبلغ</th>
                    <th className={th}>التاريخ</th>
                    <th className={th}>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id} className="border-t border-warm-200 bg-white">
                      <td className={td}>
                        <span className="flex items-center gap-2">
                          <span className={`grid size-6 shrink-0 place-items-center rounded-full text-white ${m.in ? "bg-success" : "bg-danger"}`}>
                            {m.in ? <ArrowUp className="size-3.5" aria-label="داخل" /> : <ArrowDown className="size-3.5" aria-label="خارج" />}
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
            <p className="text-sm text-warm-600">مازال ما كاين حتى معاملة: تحويلات التوصيل، المصاريف وحركات رأس المال كيبانو هنا.</p>
          )}
          <a href="#records" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink underline-offset-4 hover:underline">
            كل المصاريف وحركات رأس المال
            <ChevronLeft className="size-4" aria-hidden="true" />
          </a>
        </section>
      </div>

      <div id="details" className="mt-3 grid scroll-mt-28 gap-3 lg:grid-cols-2">
        <section className={card}>
          <CardTitle icon={TrendingUp}>حساب الربح (آخر {days} يوم)</CardTitle>
          <dl className="text-sm">
            <Line label="المبيعات المسلَّمة" value={p.revenue} />
            <Line label="تكلفة السلعة" value={p.cogs} minus />
            <Line label="رسوم التوصيل" value={p.deliveryCost} minus hint="ثمن المدينة على الطلبات اللي التوصيل فيها مجاني ولا خلصو الزبون." />
            <Line label="الربح الخام" value={p.grossProfit} total />
            <Line label="رسوم الطرود الراجعة" value={p.returnsCost} minus hint="الطرد الراجع ما كتخلص عليه والو، والسلعة كترجع للمخزون. غير إلا كتبتي رسوم فالطلب." />
            <Line label="مصاريف المشروع" value={p.businessExpenses} minus />
            <Line label="نقص فالمخزون" value={p.stockLoss} minus hint="التعديلات بالناقص من صفحة المنتج." />
            <Line label="صافي الربح" value={p.netProfit} total />
            <Line label="مصاريفك الشخصية" value={p.personalExpenses} minus />
            <Line label="اللي بقا بعد مصاريفك" value={p.afterPersonal} total />
          </dl>
        </section>

        <section className={card}>
          <CardTitle icon={Landmark}>رأس المال: فين كاينين الفلوس (من البداية)</CardTitle>
          <dl className="text-sm">
            <Line label="الكاش" value={c.cash} hint="اللي دخلتي + تحويلات التوصيل − المشتريات − كل المصاريف" />
            <Line label="السلعة فالمخزون" value={c.inventoryValue} hint="بثمن الشراء" />
            <Line label="سلعة فالطريق" value={c.goodsInTransit} hint="طلبات مأكدة ولا فالشحن، مازال ما توصلوش. بثمن الشراء." />
            <Line label="فلوس عند شركة التوصيل" value={c.owedByCarrier} hint="طلبات تسلمات للزبون، والفلوس مازال ما حولتهاش ليك الشركة. بثمن البيع ناقص الرسوم." />
            <Line label="المجموع اليوم" value={c.position} total />
            <Line label="اللي استثمرتي" value={c.invested} hint={`دخلتي ${mad(c.injections)} + سلعة البداية ${mad(c.openingStockValue)} − سحبتي ${mad(c.withdrawals)}`} />
            <Line label={c.result < 0 ? "الخسارة منذ البداية" : "الربح منذ البداية"} value={c.result} total hint={c.resultPct === null ? undefined : `${c.resultPct}% من اللي استثمرتي، والمصاريف الشخصية محسوبة`} />
          </dl>
        </section>
      </div>

      <section className={`${card} mt-3`} aria-labelledby="cod-title">
        <CardTitle icon={Receipt}>
          <span id="cod-title">عند شركة التوصيل ({uncollected.length})</span>
        </CardTitle>
        {uncollected.length ? (
          <ActionForm action={markCodReceived} submitLabel="توصلت بالطلبات المحددة" className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-2xl ring-1 ring-warm-200">
              <table className="w-full min-w-[36rem]">
                <thead className="bg-warm-100">
                  <tr>
                    <th className={th}>
                      <span className="sr-only">اختيار</span>
                    </th>
                    <th className={th}>الطلب</th>
                    <th className={th}>الزبون</th>
                    <th className={th}>تسلّم</th>
                    <th className={th}>المنتظر</th>
                  </tr>
                </thead>
                <tbody>
                  {uncollected.map((o) => (
                    <tr key={o.id} className="border-t border-warm-200 bg-white">
                      <td className={td}>
                        <input type="checkbox" name="orderId" value={o.id} aria-label={`اختيار ${o.number}`} className="size-5 accent-yellow-500" />
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
            <p className="text-xs text-warm-600">المنتظر هو المبلغ ناقص رسوم التوصيل. إلا توصلتي بمبلغ آخر، سجلو من صفحة الطلب.</p>
          </ActionForm>
        ) : (
          <p className="text-sm text-warm-600">ما كاين حتى طلب مسلَّم كيتسنى التحويل.</p>
        )}
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {(
          [
            { scope: "BUSINESS", title: "مصروف ديال المشروع", categories: BUSINESS_CATEGORIES, note: undefined },
            { scope: "PERSONAL", title: "مصروف ولا خسارة شخصية", categories: PERSONAL_CATEGORIES, note: "ما كيدخلش فربح المشروع، ولكن كينقص من الكاش ومن نتيجة رأس المال." },
          ] as const
        ).map((f) => (
          <section key={f.scope} className={card}>
            <h2 className="mb-3 text-base text-ink">{f.title}</h2>
            <ActionForm action={addExpense} submitLabel="إضافة">
              <input type="hidden" name="scope" value={f.scope} />
              <Field label="النوع">
                <select name="category" className={field}>
                  {Object.entries(f.categories).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المبلغ (درهم)">
                <input name="amount" type="number" min={1} required className={field} />
              </Field>
              <Field label="التاريخ">
                <input name="spentOn" type="date" required defaultValue={today} className={field} />
              </Field>
              <Field label="ملاحظة">
                <input name="note" maxLength={200} className={field} />
              </Field>
            </ActionForm>
            {f.note ? <p className="mt-3 text-xs text-warm-600">{f.note}</p> : null}
          </section>
        ))}

        <section className={card}>
          <h2 className="mb-3 text-base text-ink">حركة رأس المال</h2>
          <ActionForm action={addCapital} submitLabel="إضافة">
            <Field label="النوع">
              <select name="type" className={field}>
                <option value="INJECTION">دخلت فلوس للمشروع</option>
                <option value="WITHDRAWAL">سحبت فلوس من المشروع</option>
              </select>
            </Field>
            <Field label="المبلغ (درهم)">
              <input name="amount" type="number" min={1} required className={field} />
            </Field>
            <Field label="التاريخ">
              <input name="occurredOn" type="date" required defaultValue={today} className={field} />
            </Field>
            <Field label="ملاحظة">
              <input name="note" maxLength={200} className={field} />
            </Field>
          </ActionForm>
        </section>
      </div>

      <div id="records" className="mt-3 grid scroll-mt-28 gap-3 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-3 text-base text-ink">آخر المصاريف</h2>
          {expenses.length ? (
            <ul className="flex flex-col divide-y divide-warm-200 text-sm">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">
                      {categoryLabel(e.scope, e.category)}
                      <span className="ms-2 rounded-md bg-warm-100 px-1.5 py-0.5 text-xs font-normal text-warm-700">{e.scope === "PERSONAL" ? "شخصي" : "المشروع"}</span>
                    </span>
                    <span className="block truncate text-xs text-warm-600">
                      {dayFmt.format(e.spentOn)}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <b className="text-ink">{mad(e.amount)}</b>
                    <DeleteButton action={deleteExpense} id={e.id} label="حذف المصروف" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-600">مازال ما تسجل حتى مصروف.</p>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-3 text-base text-ink">حركات رأس المال</h2>
          {capitalEntries.length ? (
            <ul className="flex flex-col divide-y divide-warm-200 text-sm">
              {capitalEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{e.type === "INJECTION" ? "دخلت فلوس" : "سحبت فلوس"}</span>
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
                    <DeleteButton action={deleteCapital} id={e.id} label="حذف الحركة" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-600">سجل شحال دخلتي فالمشروع باش يتحسب رأس المال بالصح.</p>
          )}
        </section>
      </div>
    </div>
  );
}
