import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Megaphone,
  Package,
  PackageX,
  PhoneCall,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Truck,
  Undo2,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { AreaChart } from "@/components/admin/AreaChart";
import { STATUS_LABEL } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminLang, type AdminLang } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { changePct } from "@/lib/finance";
import { loadProfit } from "@/lib/finance-data";
import { formatMAD } from "@/lib/money";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-rules";
import { chartSlots, periodLabel, resolvePeriod } from "@/lib/period";
import { codRates } from "@/lib/stats";
import { PeriodPicker } from "@/components/admin/PeriodPicker";
import { TIME_ZONE } from "@/lib/time";

const TZ = TIME_ZONE;

const STATUS_EN: Record<OrderStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  SHIPPING: "Shipping",
  DELIVERED: "Delivered",
  RETURNING: "Returning",
  RETURNED: "Returned",
};
const STATUS_DOT: Record<OrderStatus, string> = {
  NEW: "bg-yellow-500",
  CONFIRMED: "bg-warm-600",
  CANCELLED: "bg-danger",
  SHIPPING: "bg-ink",
  DELIVERED: "bg-success",
  RETURNING: "bg-warning",
  RETURNED: "bg-warm-500",
};

// Every word on the page, in both languages.
const T = {
  ar: {
    morning: "صباح الخير",
    evening: "مساء الخير",
    intro: "هذا اللي خاصو انتباهك اليوم فالمتجر.",
    period: "الفترة",
    newOrder: "طلب جديد",
    today: "طلبات اليوم",
    todayFoot: "من منتصف الليل",
    orders: "الطلبات",
    vsBefore: (n: number) => `مقابل ${n} فالفترة اللي قبل`,
    confirm: "نسبة التأكيد",
    confirmFoot: "من الطلبات اللي تعيّط عليها",
    deliver: "نسبة التسليم",
    returns: (n: number) => `الإرجاع ${n}%`,
    revenue: "المداخيل",
    revenueFoot: "من الطلبات المسلَّمة",
    net: "صافي الربح",
    margin: (n: number) => `الهامش ${n}%`,
    noSales: "ما كاين حتى بيع",
    noData: "ما كاين بيانات",
    costs: "السلعة والتوصيل",
    returnsLoss: "خسائر الإرجاع",
    returnedOrders: (n: number) => `${n} طلب راجع`,
    expenses: "مصاريف المشروع",
    adPerOrder: (v: string) => `الإعلان لكل طلب ${v}`,
    gaps: "الربح ناقص معلومات: ثمن شراء ولا رسوم توصيل. كمّلهم فالمالية.",
    todayTitle: "نتائج اليوم",
    exportReady: "صدّر لشركة التوصيل",
    seeAll: "شوف الكل",
    confirmedShort: "مؤكَّدة",
    ringLabel: (n: number, all: number) => `${n} مؤكَّدة من ${all} طلب اليوم`,
    confirmedToday: (n: number) => (n === 0 ? "حتى طلب ما تأكّد اليوم مازال" : n === 1 ? "طلب واحد تأكّد اليوم" : `${n} طلبات تأكّدو اليوم`),
    outOf: (n: number) => `من أصل ${n} طلب اليوم`,
    nothingYet: "النهار مازال فاللول",
    legendConfirmed: "مؤكَّدة",
    legendWaiting: "كتسنّى",
    legendCancelled: "ملغاة",
    readyTitle: "جاهزين للشحن",
    readyCount: (n: number) => `${n} كتسنّى الموزع`,
    more: (n: number) => `+${n} طلبات أخرى`,
    noConfirmed: "ما كاين حتى طلب مؤكَّد كيتسنّى الشحن. ملي تأكّد شي طلب غادي يبان هنا.",
    items: (n: number) => `${n} ${n === 1 ? "منتج" : "منتجات"}`,
    todoCall: (n: number) => `عيّط على ${n} ${n === 1 ? "طلب" : "طلبات"}`,
    citiesTitle: "أكثر المدن طلباً",
    citiesSub: (span: string, n: number) => `${span} · ${n} طلب`,
    noCities: "ما كاين حتى طلب فهاد الفترة.",
    daily: "الطلبات اليومية",
    monthly: "الطلبات الشهرية",
    unit: "طلب",
    top: "أكثر المنتجات مبيعاً",
    topSub: (span: string) => `${span} · مرتبة بالقطع المسلَّمة`,
    allProducts: "كل المنتجات",
    colProduct: "المنتج",
    colPrice: "الثمن",
    colDelivered: "تسلّمو",
    colReturned: "رجعو",
    colRevenue: "المداخيل",
    colCost: "ثمن الشراء",
    colProfit: "الربح",
    trendUp: "طالع على الفترة اللي قبل",
    trendDown: "نازل على الفترة اللي قبل",
    missingCost: "ناقص ثمن الشراء ديال شي قطع",
    profitNote: "الربح هنا = مداخيل القطع المسلَّمة ناقص ثمن شرائها، قبل التوصيل والإعلانات. السهم كيقارن مع الفترة اللي قبل.",
    noTop: "ما كاين حتى بيع فهاد الفترة.",
    low: "قربات تسالي",
    out: "سالات",
    left: (n: number) => `بقي ${n}`,
    byStatus: "الطلبات حسب الحالة",
    allOrders: "كل الطلبات",
  },
  en: {
    morning: "Good morning",
    evening: "Good evening",
    intro: "Here is what needs your attention in the shop today.",
    period: "Period",
    newOrder: "New order",
    today: "Orders today",
    todayFoot: "since midnight",
    orders: "Orders",
    vsBefore: (n: number) => `vs ${n} the period before`,
    confirm: "Confirmation rate",
    confirmFoot: "of the orders you called",
    deliver: "Delivery rate",
    returns: (n: number) => `${n}% returned`,
    revenue: "Revenue",
    revenueFoot: "from delivered orders",
    net: "Net profit",
    margin: (n: number) => `${n}% margin`,
    noSales: "no sales yet",
    noData: "No data yet",
    costs: "Goods & delivery",
    returnsLoss: "Return losses",
    returnedOrders: (n: number) => `${n} returned`,
    expenses: "Business expenses",
    adPerOrder: (v: string) => `${v} ads per order`,
    gaps: "Profit is missing data: a purchase price or delivery fee. Complete it in Finance.",
    todayTitle: "Today's results",
    exportReady: "Export for the carrier",
    seeAll: "See all",
    confirmedShort: "confirmed",
    ringLabel: (n: number, all: number) => `${n} confirmed of ${all} orders today`,
    confirmedToday: (n: number) => (n === 0 ? "No order confirmed yet today" : n === 1 ? "1 order confirmed today" : `${n} orders confirmed today`),
    outOf: (n: number) => `out of ${n} orders today`,
    nothingYet: "The day is just starting",
    legendConfirmed: "Confirmed",
    legendWaiting: "Waiting",
    legendCancelled: "Cancelled",
    readyTitle: "Ready to ship",
    readyCount: (n: number) => `${n} waiting for the carrier`,
    more: (n: number) => `+${n} more orders`,
    noConfirmed: "No confirmed order is waiting to ship. Confirmed orders will show here.",
    items: (n: number) => `${n} ${n === 1 ? "item" : "items"}`,
    todoCall: (n: number) => `Call ${n} ${n === 1 ? "order" : "orders"}`,
    citiesTitle: "Top cities",
    citiesSub: (span: string, n: number) => `${span} · ${n} orders`,
    noCities: "No orders in this period.",
    daily: "Daily orders",
    monthly: "Monthly orders",
    unit: "orders",
    top: "Top products",
    topSub: (span: string) => `${span} · ranked by units delivered`,
    allProducts: "All products",
    colProduct: "Product",
    colPrice: "Price",
    colDelivered: "Delivered",
    colReturned: "Returned",
    colRevenue: "Revenue",
    colCost: "Purchase cost",
    colProfit: "Profit",
    trendUp: "Up on the period before",
    trendDown: "Down on the period before",
    missingCost: "Some units have no purchase price",
    profitNote: "Profit here = revenue of delivered units minus their purchase price, before delivery and ads. The arrow compares with the period before.",
    noTop: "No sales in this period.",
    low: "Running low",
    out: "Out",
    left: (n: number) => `${n} left`,
    byStatus: "Orders by status",
    allOrders: "All orders",
  },
};
type Words = (typeof T)["ar"];

const orderSelect = {
  id: true,
  number: true,
  status: true,
  customerName: true,
  cityName: true,
  total: true,
  _count: { select: { items: true } },
  items: {
    take: 1,
    select: { nameAr: true, nameEn: true, variant: { select: { product: { select: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } } } },
  },
} as const;

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin();
  const lang = await adminLang();
  const t = T[lang];
  const ar = lang === "ar";
  const period = resolvePeriod(await searchParams);
  const span = periodLabel(period, lang);
  const { from: since, until, prevFrom } = period;
  const inPeriod = { gte: since, lte: until };

  const [profit, byStatus, perDay, products, cities, todayByStatus, lowStock, before, confirmedIds] = await Promise.all([
    loadProfit(since, until),
    db.order.groupBy({ by: ["status"], where: { createdAt: inPeriod }, _count: true }),
    db.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM "Order" WHERE "createdAt" >= ${since} AND "createdAt" <= ${until} GROUP BY 1`,
    // Best products of the period: units delivered and sent back, money in, purchase cost of what was delivered.
    db.$queryRaw<ProductRow[]>`
      SELECT p."id", p."nameAr", p."nameEn",
        (SELECT pi."url" FROM "ProductImage" pi WHERE pi."productId" = p."id" ORDER BY pi."sortOrder" LIMIT 1) AS image,
        COALESCE(round(avg(oi."unitPrice") FILTER (WHERE o."status" = 'DELIVERED')), round(avg(oi."unitPrice")))::int AS price,
        COALESCE(sum(oi."quantity") FILTER (WHERE o."status" = 'DELIVERED'), 0)::int AS delivered,
        COALESCE(sum(oi."quantity") FILTER (WHERE o."status" IN ('RETURNING', 'RETURNED')), 0)::int AS returned,
        COALESCE(sum(oi."unitPrice" * oi."quantity") FILTER (WHERE o."status" = 'DELIVERED'), 0)::int AS revenue,
        COALESCE(sum(COALESCE(oi."unitCost", 0) * oi."quantity") FILTER (WHERE o."status" = 'DELIVERED'), 0)::int AS cost,
        COALESCE(bool_or(oi."unitCost" IS NULL) FILTER (WHERE o."status" = 'DELIVERED'), false) AS "missingCost"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Variant" v ON v."id" = oi."variantId"
      JOIN "Product" p ON p."id" = v."productId"
      WHERE o."createdAt" >= ${since} AND o."createdAt" <= ${until} AND o."status" IN ('DELIVERED', 'RETURNING', 'RETURNED')
      GROUP BY p."id"
      ORDER BY delivered DESC, revenue DESC
      LIMIT 5`,
    // Where the orders of the period go.
    db.$queryRaw<{ id: string; nameAr: string; nameEn: string; count: number }[]>`
      SELECT c."id", c."nameAr", c."nameEn", count(*)::int AS count
      FROM "Order" o JOIN "City" c ON c."id" = o."cityId"
      WHERE o."createdAt" >= ${since} AND o."createdAt" <= ${until}
      GROUP BY c."id"
      ORDER BY count DESC
      LIMIT 8`,
    // Orders that came in today (shop's time zone), by where they stand now.
    db.$queryRaw<{ status: OrderStatus; count: number }[]>`
      SELECT "status", count(*)::int AS count FROM "Order"
      WHERE (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date
      GROUP BY 1`,
    // Colours at or below their own alert level, emptiest first (products shown in the shop only).
    db.variant.findMany({
      where: { stock: { lte: db.variant.fields.lowStockAt }, product: { isActive: true } },
      select: { id: true, colorAr: true, colorEn: true, colorHex: true, storage: true, stock: true, product: { select: { id: true, nameAr: true, nameEn: true } } },
      orderBy: [{ stock: "asc" }, { product: { nameAr: "asc" } }],
      take: 12,
    }),
    // The same length of time just before, for the change badge.
    db.order.count({ where: { createdAt: { gte: prevFrom, lt: since } } }),
    // Confirmed today, whenever the order came in (a call today can confirm yesterday's order).
    db.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT "orderId" AS id FROM "OrderStatusLog"
      WHERE "toStatus" = 'CONFIRMED' AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date`,
  ]);
  // Newest confirmation first; an order cancelled since then no longer counts.
  const confirmed = await db.order.findMany({
    where: { id: { in: confirmedIds.map((r) => r.id) }, status: { not: "CANCELLED" } },
    orderBy: { updatedAt: "desc" },
    select: orderSelect,
  });
  // Ready to ship = confirmed and still waiting for the carrier, whatever day they were confirmed.
  const [ready, readyTotal] = await Promise.all([
    db.order.findMany({ where: { status: "CONFIRMED" }, orderBy: { updatedAt: "desc" }, take: 4, select: orderSelect }),
    db.order.count({ where: { status: "CONFIRMED" } }),
  ]);
  const today = Object.fromEntries(todayByStatus.map((s) => [s.status, s.count])) as Partial<Record<OrderStatus, number>>;
  const todayTotal = todayByStatus.reduce((s, r) => s + r.count, 0);

  // The same products in the period just before: the trend arrow next to each name.
  const earlier = products.length
    ? await db.$queryRaw<{ id: string; delivered: number }[]>`
        SELECT v."productId" AS id, sum(oi."quantity")::int AS delivered
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" JOIN "Variant" v ON v."id" = oi."variantId"
        WHERE o."status" = 'DELIVERED' AND o."createdAt" >= ${prevFrom} AND o."createdAt" < ${since} AND v."productId" = ANY(${products.map((p) => p.id)})
        GROUP BY 1`
    : [];
  const deliveredBefore = new Map(earlier.map((r) => [r.id, r.delivered]));

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Partial<Record<OrderStatus, number>>;
  const rates = codRates(counts);
  const series = chartSlots(perDay, period);
  const change = changePct(rates.total, before);

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  const firstName = admin.name.split(" ")[0];
  const dateLine = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(now);
  const dayLabel = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  const monthLabel = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const money = (v: number) => formatMAD(v, lang);
  const pct = (v: number | null) => (v === null ? t.noData : `${v}%`);

  return (
    <div dir={ar ? "rtl" : "ltr"} lang={lang} className="flex flex-col gap-6 md:gap-7">
      {/* Greeting + the page's actions, like the top of a cockpit. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-warm-600 uppercase">{dateLine}</p>
          <h1 className="mt-1 text-3xl md:text-4xl">
            {hour < 12 ? t.morning : t.evening}
            {firstName ? `${ar ? "، " : ", "}${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-warm-600">{t.intro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Keyed by the period, so its panel starts closed after every choice. */}
          <PeriodPicker key={period.query} basePath="/admin" preset={period.preset} firstDay={period.firstDay} lastDay={period.lastDay} today={now.toISOString().slice(0, 10)} lang={lang} label={t.period} />
          <Link href="/admin/orders/new" className={buttonClass({ className: "rounded-full" })}>
            <Plus className="size-4" aria-hidden="true" />
            {t.newOrder}
          </Link>
        </div>
      </header>

      {/* KPI strip: one number per column, a chip with its context. */}
      <section className="border-b border-warm-200 pb-5">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label={t.today} value={String(todayTotal)} foot={t.todayFoot} />
          <Kpi
            label={t.orders}
            value={String(rates.total)}
            chip={change === null ? undefined : { text: `${change > 0 ? "+" : ""}${change}%`, tone: change > 0 ? "up" : change < 0 ? "down" : "flat" }}
            foot={t.vsBefore(before)}
          />
          <Kpi label={t.confirm} value={pct(rates.confirmation)} muted={rates.confirmation === null} foot={t.confirmFoot} />
          <Kpi
            label={t.deliver}
            value={pct(rates.delivery)}
            muted={rates.delivery === null}
            chip={rates.returns === null ? undefined : { text: t.returns(rates.returns), tone: rates.returns > 20 ? "down" : "flat" }}
          />
          <Kpi label={t.revenue} value={money(profit.revenue)} foot={t.revenueFoot} />
          <Kpi
            label={t.net}
            value={money(profit.netProfit)}
            tone={profit.netProfit < 0 ? "danger" : undefined}
            chip={profit.margin === null ? undefined : { text: t.margin(profit.margin), tone: profit.netProfit < 0 ? "down" : "up" }}
            foot={profit.margin === null ? t.noSales : undefined}
          />
        </dl>
        {/* The same calculation as the finance page, so the two can never disagree. */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-warm-200/80 pt-3 text-sm">
          <Cost icon={ReceiptText} label={t.costs} value={money(profit.cogs + profit.deliveryCost)} />
          <Cost icon={Undo2} label={t.returnsLoss} value={money(profit.returnsCost)} note={t.returnedOrders(profit.returnedCount)} />
          <Cost
            icon={Megaphone}
            label={t.expenses}
            value={money(profit.businessExpenses)}
            note={profit.costPerDelivered === null ? undefined : t.adPerOrder(money(profit.costPerDelivered))}
          />
          {profit.gaps.unitsWithoutCost || profit.gaps.deliveredWithoutFee ? (
            <Link href="/admin/finance" className="inline-flex items-center gap-1.5 font-semibold text-warning-text hover:underline">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {t.gaps}
            </Link>
          ) : null}
        </div>
      </section>

      <Today t={t} lang={lang} orders={confirmed} ready={ready} readyTotal={readyTotal} today={today} dateLine={new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now)} />

      {/* Side by side, so both lists can grow downwards as data comes in. minmax(0,…) keeps long names from widening the page. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <TopProducts t={t} lang={lang} rows={products} before={deliveredBefore} span={span} />
        <TopCities t={t} lang={lang} cities={cities} total={rates.total} span={span} />
      </div>

      <div className={`grid grid-cols-[minmax(0,1fr)] gap-6 ${lowStock.length ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : ""}`}>
        <AreaChart
          className={`${CARD} bg-warm-50! shadow-none! backdrop-blur-none!`}
          title={series.monthly ? t.monthly : t.daily}
          unit={t.unit}
          lang={lang}
          data={series.points.map((d) => ({ key: d.key, label: (series.monthly ? monthLabel : dayLabel).format(new Date(`${d.key}T00:00:00Z`)), value: d.count }))}
        />

        {lowStock.length ? (
          <section className={`${CARD} p-4 md:p-5`}>
            <div>
              <h2 className="flex items-center gap-2 text-base text-warning-text">
                <PackageX className="size-5" aria-hidden="true" />
                {t.low}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {lowStock.map((v) => {
                  const color = [ar ? v.colorAr : v.colorEn, v.storage].filter(Boolean).join(" · ");
                  return (
                    <li key={v.id}>
                      <Link href={`/admin/products/${v.product.id}`} className="flex min-h-9 items-center gap-2 rounded-full border border-warm-200 bg-white px-3 text-xs text-warm-800 transition-colors hover:border-warm-300">
                        {v.colorHex ? <span className="size-3.5 shrink-0 rounded-full border border-warm-300" style={{ backgroundColor: v.colorHex }} aria-hidden="true" /> : null}
                        <span className="max-w-40 truncate">
                          {ar ? v.product.nameAr : v.product.nameEn}
                          {color ? <span className="text-warm-600"> · {color}</span> : null}
                        </span>
                        <b className={v.stock === 0 ? "text-danger" : "text-warning-text"}>{v.stock === 0 ? t.out : t.left(v.stock)}</b>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ) : null}
      </div>

      <section className={`${CARD} p-4 md:p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base">{t.byStatus}</h2>
          <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-ink hover:underline">
            {t.allOrders}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {ORDER_STATUSES.map((s) => (
            <li key={s}>
              <Link href={`/admin/orders?status=${s}`} className="flex min-h-14 flex-col justify-center rounded-xl border border-warm-200 bg-white px-3 py-2 transition-colors hover:border-warm-300">
                <span className="flex items-center gap-1.5 text-xs text-warm-600">
                  <span className={`size-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden="true" />
                  {ar ? STATUS_LABEL[s] : STATUS_EN[s]}
                </span>
                <span className="text-lg font-extrabold text-ink tabular-nums">{counts[s] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type Chip = { text: string; tone: "up" | "down" | "flat" };
const CHIP = { up: "bg-success-soft text-success", down: "bg-danger-soft text-danger", flat: "bg-warm-100 text-warm-700" };

function Kpi({ label, value, foot, chip, muted = false, tone }: { label: string; value: string; foot?: string; chip?: Chip; muted?: boolean; tone?: "danger" }) {
  return (
    // A thin rule between columns on wide screens, like the mockup's strip.
    <div className="min-w-0 lg:border-s lg:border-warm-200/80 lg:ps-5 lg:first:border-s-0 lg:first:ps-0">
      <dt className="truncate text-[11px] font-semibold tracking-wide text-warm-600 uppercase">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className={muted ? "text-sm font-semibold text-warm-600" : `text-2xl font-extrabold tabular-nums md:text-[1.75rem] ${tone === "danger" ? "text-danger" : "text-ink"}`}>{value}</span>
        {chip ? <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[chip.tone]}`}>{chip.text}</span> : null}
      </dd>
      {foot ? <dd className="mt-1 truncate text-xs text-warm-500">{foot}</dd> : null}
    </div>
  );
}

function Cost({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-warm-700">
      <Icon className="size-4 text-warm-500" aria-hidden="true" />
      {label}
      <b className="text-ink tabular-nums">{value}</b>
      {note ? <span className="text-xs text-warm-500">({note})</span> : null}
    </span>
  );
}

// Cards on the white page: a warm off-white surface with a hairline, flat like the mockup.
const CARD = "rounded-[1.5rem] border border-warm-200/80 bg-warm-50";

type TodayOrder = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

// The ring's circle: r = 52 in a 128 box.
const RING = 2 * Math.PI * 52;

/**
 * Today's results at a glance: a ring with how today's calls went (confirmed / still waiting / cancelled),
 * then the orders confirmed today, ready to hand to the carrier.
 */
function Today({
  t,
  lang,
  orders,
  ready: shown,
  readyTotal: ready,
  today,
  dateLine,
}: {
  t: Words;
  lang: AdminLang;
  orders: TodayOrder[];
  /** The latest confirmed orders still waiting for the carrier, and how many there are in all. */
  ready: TodayOrder[];
  readyTotal: number;
  today: Partial<Record<OrderStatus, number>>;
  dateLine: string;
}) {
  const ar = lang === "ar";
  const Arrow = ar ? ChevronLeft : ChevronRight;
  const confirmed = orders.length;
  const waiting = today.NEW ?? 0;
  const cancelled = today.CANCELLED ?? 0;
  const all = confirmed + waiting + cancelled;
  const value = orders.reduce((s, o) => s + o.total, 0);
  const image = (o: TodayOrder) => o.items[0]?.variant?.product.images[0]?.url ?? null;
  const name = (o: TodayOrder) => (o.items[0] ? (ar ? o.items[0].nameAr : o.items[0].nameEn) : o.number);
  const faces = orders.filter((o) => image(o)).slice(0, 4);

  // Ring segments in reading order: confirmed (brand yellow), waiting (warm), cancelled (red).
  let offset = 0;
  const segments = [
    { n: confirmed, color: "var(--color-yellow-500)" },
    { n: waiting, color: "var(--color-warm-300)" },
    { n: cancelled, color: "var(--color-danger)" },
  ].map((s) => {
    const length = all ? (s.n / all) * RING : 0;
    const seg = { ...s, length, offset };
    offset += length;
    return seg;
  });

  return (
    <section aria-labelledby="today" className={`${CARD} flex flex-col gap-6 p-5 md:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="today" className="inline-flex items-center gap-2 rounded-full bg-ink py-1 ps-1 pe-3.5 text-sm font-bold text-white">
            <span className="grid size-7 place-items-center rounded-full bg-yellow-500 text-ink">
              <Zap className="size-4" aria-hidden="true" />
            </span>
            {t.todayTitle}
          </h2>
          <span className="text-sm text-warm-600">{dateLine}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ready ? (
            // A CSV download from a route handler, not a page: a plain link, never client-side navigation.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a href="/admin/orders/export?status=CONFIRMED" className={buttonClass({ className: "min-h-10! rounded-full px-4! text-sm" })}>
              <Truck className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              {t.exportReady}
            </a>
          ) : null}
          <Link href="/admin/orders?status=CONFIRMED" className={buttonClass({ variant: "outline", className: "min-h-10! rounded-full px-4! text-sm" })}>
            {t.seeAll}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-0">
        {/* A: the counter. */}
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-start md:flex-col md:text-center lg:flex-row lg:text-start md:pe-6">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 128 128" className="size-full -rotate-90" role="img" aria-label={t.ringLabel(confirmed, all)}>
              <circle cx="64" cy="64" r="52" fill="none" stroke="var(--color-warm-100)" strokeWidth="12" />
              {segments.map((s) =>
                s.length ? (
                  <circle
                    key={s.color}
                    cx="64"
                    cy="64"
                    r="52"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="12"
                    strokeDasharray={`${Math.max(0, s.length - 3)} ${RING}`}
                    strokeDashoffset={-s.offset}
                    strokeLinecap="round"
                  />
                ) : null,
              )}
            </svg>
            <span className="absolute inset-0 grid place-content-center text-center leading-none">
              <span className="text-4xl font-extrabold text-ink tabular-nums">{confirmed}</span>
              <span className="mt-1 text-xs font-semibold text-warm-600">{t.confirmedShort}</span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xl leading-snug font-extrabold text-ink">{t.confirmedToday(confirmed)}</p>
            <p className="mt-1 text-sm text-warm-600">
              {all ? t.outOf(all) : t.nothingYet}
              {value ? (
                <>
                  {" · "}
                  <b className="text-ink">{formatMAD(value, lang)}</b>
                </>
              ) : null}
            </p>
            {faces.length ? (
              <div className="mt-3 flex justify-center sm:justify-start md:justify-center lg:justify-start">
                {faces.map((o) => (
                  <span key={o.id} className="relative -ms-2 size-10 overflow-hidden rounded-full border-2 border-white bg-white shadow-sm first:ms-0">
                    <Image src={image(o)!} alt="" fill sizes="40px" className="object-contain p-0.5" />
                  </span>
                ))}
                {confirmed > faces.length ? (
                  <span className="-ms-2 grid size-10 place-items-center rounded-full border-2 border-white bg-ink text-xs font-bold text-yellow-500">+{confirmed - faces.length}</span>
                ) : null}
              </div>
            ) : null}
            <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-warm-700 sm:justify-start md:justify-center lg:justify-start">
              <li className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-yellow-500" aria-hidden="true" />
                {t.legendConfirmed} <b className="text-ink">{confirmed}</b>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warm-300" aria-hidden="true" />
                {t.legendWaiting} <b className="text-ink">{waiting}</b>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
                {t.legendCancelled} <b className="text-ink">{cancelled}</b>
              </li>
            </ul>
          </div>
        </div>

        {/* C: the confirmed orders waiting for the carrier. */}
        <div className="min-w-0 md:border-s md:border-warm-200 md:ps-6">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">{t.readyTitle}</h3>
            <span className="text-xs text-warm-600">{t.readyCount(ready)}</span>
          </div>
          {shown.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {shown.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-2.5 py-2 shadow-[0_6px_18px_-14px] shadow-ink/40 transition-colors hover:bg-warm-100">
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-warm-100">
                      {image(o) ? (
                        <Image src={image(o)!} alt="" fill sizes="44px" className="object-contain p-1 mix-blend-multiply" />
                      ) : (
                        <Package className="absolute inset-0 m-auto size-5 text-warm-500" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-bold text-ink">{name(o)}</span>
                      <span className="block truncate text-xs text-warm-600">
                        {o.customerName} · {o.cityName}
                        {o._count.items > 1 ? ` · ${t.items(o._count.items)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-extrabold text-ink tabular-nums">{formatMAD(o.total, lang)}</span>
                  </Link>
                </li>
              ))}
              {ready > shown.length ? (
                <li>
                  <Link href="/admin/orders?status=CONFIRMED" className="flex min-h-10 items-center justify-center gap-1 text-sm font-semibold text-ink hover:underline">
                    {t.more(ready - shown.length)}
                    <Arrow className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-warm-300 px-4 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-warm-100 text-warm-600">
                <PhoneCall className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-warm-600">{t.noConfirmed}</p>
              {waiting ? (
                <Link href="/admin/orders?status=NEW" className={buttonClass({ variant: "dark", className: "min-h-10! rounded-full px-4! text-sm" })}>
                  {t.todoCall(waiting)}
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
type ProductRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  image: string | null;
  price: number;
  delivered: number;
  returned: number;
  revenue: number;
  cost: number;
  missingCost: boolean;
};

/** Where the period's orders go: one bar per city, the leader in brand yellow. */
function TopCities({ t, lang, cities, total, span }: { t: Words; lang: AdminLang; cities: { id: string; nameAr: string; nameEn: string; count: number }[]; total: number; span: string }) {
  const max = Math.max(1, ...cities.map((c) => c.count));
  return (
    <section aria-labelledby="cities" className={`${CARD} flex flex-col p-5 md:p-6`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="cities" className="flex items-center gap-2 text-base">
            <MapPin className="size-4.5 text-warm-600" aria-hidden="true" />
            {t.citiesTitle}
          </h2>
          <p className="mt-0.5 text-xs text-warm-600">{t.citiesSub(span, total)}</p>
        </div>
      </div>
      {cities.length ? (
        <ol className="mt-5 flex flex-col gap-3.5">
          {cities.map((c, i) => {
            const share = total ? Math.round((c.count / total) * 1000) / 10 : 0;
            return (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-bold text-ink">{lang === "ar" ? c.nameAr : c.nameEn}</span>
                  <span className="shrink-0 tabular-nums">
                    <b className="text-ink">{c.count}</b> <span className="text-xs text-warm-500">({share}%)</span>
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-warm-200/80" aria-hidden="true">
                  <div className={`absolute inset-y-0 start-0 rounded-full ${i === 0 ? "bg-yellow-500" : "bg-ink"}`} style={{ width: `${(c.count / max) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-5 text-sm text-warm-600">{t.noCities}</p>
      )}
    </section>
  );
}

/** The period's best products: price, units delivered and returned, money in, purchase cost and profit. */
function TopProducts({ t, lang, rows, before, span }: { t: Words; lang: AdminLang; rows: ProductRow[]; before: Map<string, number>; span: string }) {
  const ar = lang === "ar";
  const money = (v: number) => formatMAD(v, lang);
  // Tight columns: the table shares its row with the cities.
  const th = "px-2.5 py-3 text-start text-xs font-semibold whitespace-nowrap text-warm-600 first:ps-5 last:pe-5";
  const td = "px-2.5 py-3 whitespace-nowrap tabular-nums first:ps-5 last:pe-5";
  return (
    <section aria-labelledby="products" className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-2 md:px-6 md:pt-6">
        <div>
          <h2 id="products" className="text-base">
            {t.top}
          </h2>
          <p className="mt-0.5 text-xs text-warm-600">{t.topSub(span)}</p>
        </div>
        <Link href="/admin/products" className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-ink transition-colors hover:bg-warm-100">
          {t.allProducts}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </div>
      {rows.length ? (
        <>
          {/* Scrolls sideways on phones instead of squeezing the numbers. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-warm-200">
                <tr>
                  <th scope="col" className={th}>{t.colProduct}</th>
                  <th scope="col" className={th}>{t.colPrice}</th>
                  <th scope="col" className={th}>{t.colDelivered}</th>
                  <th scope="col" className={th}>{t.colReturned}</th>
                  <th scope="col" className={th}>{t.colRevenue}</th>
                  <th scope="col" className={th}>{t.colCost}</th>
                  <th scope="col" className={th}>{t.colProfit}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-200/80">
                {rows.map((r) => {
                  const name = ar ? r.nameAr : r.nameEn;
                  const prev = before.get(r.id);
                  const trend = prev === undefined ? (r.delivered ? "up" : null) : r.delivered > prev ? "up" : r.delivered < prev ? "down" : null;
                  const gain = r.revenue - r.cost;
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-white">
                      <td className={td}>
                        <Link href={`/admin/products/${r.id}`} className="flex max-w-56 items-center gap-3">
                          <span className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-warm-200 bg-white">
                            {r.image ? <Image src={r.image} alt="" fill sizes="44px" className="object-contain p-1" /> : <Package className="absolute inset-0 m-auto size-5 text-warm-400" aria-hidden="true" />}
                          </span>
                          <span className="truncate font-bold text-ink">{name}</span>
                          {trend === "up" ? (
                            <TrendingUp className="size-4 shrink-0 text-success" aria-label={t.trendUp} />
                          ) : trend === "down" ? (
                            <TrendingDown className="size-4 shrink-0 text-danger" aria-label={t.trendDown} />
                          ) : null}
                        </Link>
                      </td>
                      <td className={`${td} text-warm-800`}>{money(r.price)}</td>
                      <td className={`${td} font-bold text-ink`}>{r.delivered}</td>
                      <td className={`${td} ${r.returned ? "font-bold text-danger" : "text-warm-600"}`}>{r.returned}</td>
                      <td className={`${td} text-warm-800`}>{money(r.revenue)}</td>
                      <td className={`${td} text-warm-800`}>
                        {money(r.cost)}
                        {r.missingCost ? (
                          <span title={t.missingCost} className="ms-1 inline-flex align-middle text-warning-text">
                            <AlertTriangle className="size-3.5" aria-label={t.missingCost} />
                          </span>
                        ) : null}
                      </td>
                      <td className={`${td} font-extrabold ${gain > 0 ? "text-success" : gain < 0 ? "text-danger" : "text-warm-600"}`}>{money(gain)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-warm-200 px-5 py-3 text-xs text-warm-600 md:px-6">{t.profitNote}</p>
        </>
      ) : (
        <p className="px-5 pt-2 pb-6 text-sm text-warm-600 md:px-6">{t.noTop}</p>
      )}
    </section>
  );
}
