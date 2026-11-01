import { AlertTriangle, CalendarClock, PackageX, PhoneCall, ShoppingCart, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { AreaChart } from "@/components/admin/AreaChart";
import { PageHeader, Panel, Stat, StatusBadge } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-rules";
import { codRates, daysAgo, fillDays } from "@/lib/stats";
import { colorLabel } from "@/lib/stock";

const RANGES = [7, 30, 90] as const;
const TZ = "Africa/Casablanca";
// Whole dates on the chart axis: "31 أكتوبر".
const dayLabel = new Intl.DateTimeFormat("ar-MA", { day: "numeric", month: "long", timeZone: "UTC" });
const NO_DATA = "لا توجد بيانات بعد";
const pctText = (v: number | null) => (v === null ? NO_DATA : `${v}%`);

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;
  const since = daysAgo(days);

  const [byStatus, perDay, revenue, top, today, risky, todayRow, lowStock] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }),
    db.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM "Order" WHERE "createdAt" >= ${since} GROUP BY 1`,
    db.order.aggregate({ where: { createdAt: { gte: since }, status: "DELIVERED" }, _sum: { total: true } }),
    db.orderItem.groupBy({
      by: ["nameAr"],
      where: { order: { createdAt: { gte: since }, status: { notIn: ["CANCELLED", "RETURNED"] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM "Order"
      WHERE (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date`,
    db.order.count({ where: { status: "NEW", riskScore: { gte: 30 } } }),
    db.$queryRaw<{ today: string }[]>`SELECT to_char(now() AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS today`,
    // Colours at or below their own alert level, emptiest first (products shown in the shop only).
    db.variant.findMany({
      where: { stock: { lte: db.variant.fields.lowStockAt }, product: { isActive: true } },
      select: { id: true, colorAr: true, colorHex: true, storage: true, stock: true, lowStockAt: true, product: { select: { id: true, nameAr: true } } },
      orderBy: [{ stock: "asc" }, { product: { nameAr: "asc" } }],
      take: 12,
    }),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Partial<Record<OrderStatus, number>>;
  const rates = codRates(counts);
  const series = fillDays(perDay, todayRow[0].today, days);
  const topMax = Math.max(1, ...top.map((t) => t._sum.quantity ?? 0));

  return (
    <>
      <PageHeader
        title="الإحصائيات"
        description={`آخر ${days} يوماً`}
        actions={RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin?days=${r}`}
            aria-current={r === days ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${r === days ? "bg-ink text-white shadow-lg shadow-ink/20" : "admin-field text-ink hover:bg-white"}`}
          >
            {r} يوم
          </Link>
        ))}
      />

      {rates.pending || risky ? (
        <Link
          href="/admin/orders?status=NEW"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft/85 p-4 text-warning-text shadow-sm backdrop-blur-sm hover:underline"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <span className="font-semibold">
            {counts.NEW ?? 0} طلب جديد بانتظار الاتصال{risky ? `، منها ${risky} مشبوهة` : ""}
          </span>
        </Link>
      ) : null}

      {lowStock.length ? (
        <section aria-labelledby="low-stock" className="mb-6 rounded-2xl border border-warning/40 bg-warning-soft/85 p-4 text-warning-text shadow-sm backdrop-blur-sm">
          <h2 id="low-stock" className="flex items-center gap-2 text-base text-warning-text">
            <PackageX className="size-5 shrink-0" aria-hidden="true" />
            {lowStock.length} {lowStock.length === 1 ? "لون اقترب من النفاد" : "ألوان اقتربت من النفاد"}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {lowStock.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/admin/products/${v.product.id}`}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-white/80 px-3 text-sm text-warm-800 transition-colors hover:bg-white"
                >
                  {v.colorHex ? <span className="size-4 shrink-0 rounded-full border border-warm-300" style={{ backgroundColor: v.colorHex }} aria-hidden="true" /> : null}
                  <span className="max-w-48 truncate">
                    {v.product.nameAr}
                    {colorLabel(v) ? <span className="text-warm-600"> · {colorLabel(v)}</span> : null}
                  </span>
                  <b className={v.stock === 0 ? "text-danger" : "text-warning-text"}>{v.stock === 0 ? "نفد" : `بقي ${v.stock}`}</b>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={CalendarClock} label="طلبات اليوم" value={String(today[0].count)} />
        <Stat icon={ShoppingCart} label="الطلبات" value={String(rates.total)} hint={`آخر ${days} يوماً`} />
        <Stat
          icon={PhoneCall}
          label="نسبة التأكيد"
          value={pctText(rates.confirmation)}
          empty={rates.confirmation === null}
          hint="من الطلبات التي تم الاتصال بها"
        />
        <Stat
          icon={Truck}
          label="نسبة التسليم"
          value={pctText(rates.delivery)}
          empty={rates.delivery === null}
          hint={rates.returns === null ? undefined : `نسبة الإرجاع ${rates.returns}%`}
        />
        <Stat icon={Wallet} label="المداخيل (المسلَّمة)" value={formatMAD(revenue._sum.total ?? 0, "ar")} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <AreaChart
          title="الطلبات اليومية"
          data={series.map((d) => ({ key: d.day, label: dayLabel.format(new Date(`${d.day}T00:00:00Z`)), value: d.count }))}
        />

        <Panel title="الأكثر مبيعاً">
          {top.length ? (
            <ol className="flex flex-col gap-3">
              {top.map((t) => (
                <li key={t.nameAr}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate text-warm-800">{t.nameAr}</span>
                    <span className="font-bold text-ink">{t._sum.quantity}</span>
                  </div>
                  {/* One track; the fill grows from the start edge (the right, in Arabic). */}
                  <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-warm-200/70" aria-hidden="true">
                    <div className="absolute inset-y-0 start-0 rounded-full bg-ink" style={{ width: `${((t._sum.quantity ?? 0) / topMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-warm-600">لا توجد مبيعات في هذه الفترة.</p>
          )}
        </Panel>
      </div>

      <Panel title="الطلبات حسب الحالة" className="mt-6">
        <ul className="flex flex-wrap gap-3">
          {ORDER_STATUSES.map((s) => (
            <li key={s}>
              <Link href={`/admin/orders?status=${s}`} className="flex min-h-11 items-center gap-2 admin-field rounded-lg px-3 transition-colors hover:bg-white">
                <StatusBadge status={s} />
                <span className="font-bold text-ink">{counts[s] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
