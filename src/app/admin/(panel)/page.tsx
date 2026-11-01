import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { BarChart } from "@/components/admin/BarChart";
import { PageHeader, Panel, Stat, StatusBadge } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-rules";
import { codRates, daysAgo, fillDays } from "@/lib/stats";

const RANGES = [7, 30, 90] as const;
const TZ = "Africa/Casablanca";
const dayLabel = new Intl.DateTimeFormat("ar-MA", { day: "numeric", month: "short", timeZone: "UTC" });
const pctText = (v: number | null) => (v === null ? "—" : `${v}%`);

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;
  const since = daysAgo(days);

  const [byStatus, perDay, revenue, top, today, risky, todayRow] = await Promise.all([
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
            className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${r === days ? "bg-ink text-white" : "border border-warm-200 bg-white text-ink hover:bg-warm-100"}`}
          >
            {r} يوم
          </Link>
        ))}
      />

      {rates.pending || risky ? (
        <Link
          href="/admin/orders?status=NEW"
          className="mb-6 flex items-center gap-3 rounded-xl border border-warning bg-warning-soft p-4 text-warning-text hover:underline"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <span className="font-semibold">
            {counts.NEW ?? 0} طلب جديد بانتظار الاتصال{risky ? `، منها ${risky} مشبوهة` : ""}
          </span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="طلبات اليوم" value={String(today[0].count)} />
        <Stat label="الطلبات" value={String(rates.total)} hint={`آخر ${days} يوماً`} />
        <Stat label="نسبة التأكيد" value={pctText(rates.confirmation)} hint="من الطلبات التي تم الاتصال بها" />
        <Stat label="نسبة التسليم" value={pctText(rates.delivery)} hint={`نسبة الإرجاع ${pctText(rates.returns)}`} />
        <Stat label="المداخيل (المسلَّمة)" value={formatMAD(revenue._sum.total ?? 0, "ar")} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <BarChart
          title="الطلبات اليومية"
          data={series.map((d) => ({ key: d.day, value: d.count }))}
          formatLabel={(k) => dayLabel.format(new Date(`${k}T00:00:00Z`))}
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
                  <div className="mt-1 h-2 rounded-full bg-warm-100" aria-hidden="true">
                    <div className="h-2 rounded-full bg-ink" style={{ width: `${((t._sum.quantity ?? 0) / topMax) * 100}%` }} />
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
              <Link href={`/admin/orders?status=${s}`} className="flex min-h-11 items-center gap-2 rounded-lg border border-warm-200 px-3 hover:bg-warm-50">
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
