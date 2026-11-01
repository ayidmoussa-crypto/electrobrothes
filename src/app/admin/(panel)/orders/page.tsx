import { Download, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { StatusButtons, type StatusOption } from "@/components/admin/StatusButtons";
import { PageHeader, StatusBadge, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { filterQuery, orderWhere, parseOrderFilters } from "@/lib/admin-orders";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";
import { STATUS_LABEL } from "@/components/admin/ui";

const PAGE = 30;

// The everyday next step per status; everything else is on the order page.
const QUICK: Record<OrderStatus, StatusOption[]> = {
  NEW: [
    { to: "CONFIRMED", label: "تأكيد", variant: "primary" },
    { to: "CANCELLED", label: "إلغاء", variant: "outline" },
  ],
  CONFIRMED: [{ to: "SHIPPING", label: "شحن", variant: "dark" }],
  SHIPPING: [{ to: "DELIVERED", label: "تم التسليم", variant: "dark" }],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};
const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" });

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const f = parseOrderFilters(await searchParams);
  const where = orderWhere(f);
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * PAGE,
      take: PAGE,
      select: { id: true, number: true, createdAt: true, customerName: true, phone: true, cityName: true, total: true, status: true, riskScore: true, _count: { select: { items: true } } },
    }),
    db.order.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const input = "min-h-11 admin-field rounded-lg px-3 text-sm text-warm-800";

  return (
    <>
      <PageHeader
        title="الطلبات"
        description={`${total} طلب`}
        actions={
          <a href={`/admin/orders/export${filterQuery({ ...f, page: 1 })}`} className={buttonClass({ variant: "dark" })}>
            <Download className="size-4" aria-hidden="true" />
            تصدير CSV لشركة التوصيل
          </a>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 admin-card p-3">
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          بحث
          <input name="q" defaultValue={f.q} placeholder="رقم الطلب، الاسم أو الهاتف" className={`${input} w-56`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          الحالة
          <select name="status" defaultValue={f.status ?? ""} className={input}>
            <option value="">الكل</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          من
          <input type="date" name="from" defaultValue={f.from} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          إلى
          <input type="date" name="to" defaultValue={f.to} className={input} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-warm-800">
          <input type="checkbox" name="risky" value="1" defaultChecked={f.risky} className="size-5 accent-ink" />
          المشبوهة فقط
        </label>
        <button type="submit" className={buttonClass()}>
          تصفية
        </button>
        <Link href="/admin/orders" className={buttonClass({ variant: "ghost" })}>
          مسح
        </Link>
      </form>

      <div className="overflow-x-auto admin-card">
        <table className="w-full min-w-[56rem]">
          <thead className="border-b border-white/70 bg-white/45">
            <tr>
              <th className={thClass}>الطلب</th>
              <th className={thClass}>التاريخ</th>
              <th className={thClass}>الزبون</th>
              <th className={thClass}>المدينة</th>
              <th className={thClass}>المبلغ</th>
              <th className={thClass}>الحالة</th>
              <th className={thClass}>إجراء سريع</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-warm-200/60 last:border-0 transition-colors hover:bg-white/60">
                <td className={tdClass}>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold text-ink underline-offset-4 hover:underline" dir="ltr">
                    {o.number}
                  </Link>
                  {o.riskScore >= 30 ? (
                    <Badge tone="warning" className="ms-2" icon={<ShieldAlert className="size-3.5" aria-hidden="true" />}>
                      مشبوه {o.riskScore}
                    </Badge>
                  ) : null}
                </td>
                <td className={tdClass}>{dateFmt.format(o.createdAt)}</td>
                <td className={tdClass}>
                  <span className="block font-medium text-ink">{o.customerName}</span>
                  <a href={`tel:${o.phone}`} className="text-xs text-warm-600" dir="ltr">
                    {formatMoroccanPhone(o.phone)}
                  </a>
                </td>
                <td className={tdClass}>{o.cityName}</td>
                <td className={`${tdClass} font-bold text-ink`}>{formatMAD(o.total, "ar")}</td>
                <td className={tdClass}>
                  <StatusBadge status={o.status} />
                </td>
                <td className={tdClass}>
                  {QUICK[o.status].length ? (
                    <StatusButtons orderId={o.id} options={QUICK[o.status]} />
                  ) : (
                    <Link href={`/admin/orders/${o.id}`} className="text-sm text-warm-600 underline-offset-4 hover:underline">
                      التفاصيل
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!orders.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-warm-600">
                  لا توجد طلبات مطابقة.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label="الصفحات" className="mt-4 flex flex-wrap gap-1">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/admin/orders${filterQuery({ ...f, page: n })}`}
              aria-current={n === f.page ? "page" : undefined}
              className={buttonClass({ variant: n === f.page ? "dark" : "ghost", size: "icon" })}
            >
              {n}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
