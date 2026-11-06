import { Download, Plus, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { StatusButtons, type StatusOption } from "@/components/admin/StatusButtons";
import { PageHeader, StatusBadge, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { filterQuery, orderWhere, parseOrderFilters } from "@/lib/admin-orders";
import { db } from "@/lib/db";
import { SOURCE_LABEL } from "@/lib/manual-order";
import { formatMAD } from "@/lib/money";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";
import { STATUS_LABEL } from "@/components/admin/ui";
import { TIME_ZONE } from "@/lib/time";

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
const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });

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
      select: {
        id: true,
        number: true,
        createdAt: true,
        customerName: true,
        phone: true,
        cityName: true,
        address: true,
        total: true,
        status: true,
        riskScore: true,
        source: true,
        trackingNumber: true,
        codReceivedAt: true,
        _count: { select: { items: true } },
        items: { take: 1, select: { nameAr: true, variant: { select: { product: { select: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } } } } },
      },
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
          <>
            <Link href="/admin/orders/new" className={buttonClass()}>
              <Plus className="size-4" aria-hidden="true" />
              إضافة طلب
            </Link>
            <a href={`/admin/orders/export${filterQuery({ ...f, page: 1 })}`} className={buttonClass({ variant: "dark" })}>
              <Download className="size-4" aria-hidden="true" />
              تصدير CSV لشركة التوصيل
            </a>
          </>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 admin-card p-3">
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          بحث
          <input name="q" defaultValue={f.q} placeholder="رقم الطلب، التتبع، الاسم أو الهاتف" className={`${input} w-56`} />
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
        <table className="w-full min-w-[72rem]">
          <thead className="border-b border-white/70 bg-white/45">
            <tr>
              <th className={thClass}>الطلب</th>
              <th className={thClass}>التاريخ</th>
              <th className={thClass}>الزبون</th>
              <th className={thClass}>العنوان</th>
              <th className={thClass}>التحصيل</th>
              <th className={thClass}>الحالة</th>
              <th className={thClass}>المبلغ</th>
              <th className={thClass}>إجراء سريع</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const first = o.items[0];
              const image = first?.variant?.product.images[0]?.url;
              return (
              <tr key={o.id} className="border-b border-warm-200/60 last:border-0 transition-colors hover:bg-white/60">
                <td className={tdClass}>
                  <div className="flex items-center gap-3">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white">
                      {image ? <Image src={image} alt="" fill sizes="48px" unoptimized className="object-contain p-1" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold text-ink underline-offset-4 hover:underline" dir="ltr">
                          {o.number}
                        </Link>
                        <span className="text-xs text-warm-600">{o._count.items > 1 ? `${o._count.items} منتجات` : "منتج واحد"}</span>
                      </span>
                      {first ? <span className="block max-w-56 truncate text-xs text-warm-600">{first.nameAr}</span> : null}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {o.source !== "WEBSITE" ? <Badge tone="neutral">{SOURCE_LABEL[o.source]}</Badge> : null}
                        {o.riskScore >= 30 ? (
                          <Badge tone="warning" icon={<ShieldAlert className="size-3.5" aria-hidden="true" />}>
                            مشبوه {o.riskScore}
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                  </div>
                </td>
                <td className={tdClass}>{dateFmt.format(o.createdAt)}</td>
                <td className={tdClass}>
                  <span className="block font-medium text-ink">{o.customerName}</span>
                  <a href={`tel:${o.phone}`} className="text-xs text-warm-600" dir="ltr">
                    {formatMoroccanPhone(o.phone)}
                  </a>
                </td>
                <td className={tdClass}>
                  <span className="block max-w-48 truncate" title={o.address}>
                    {o.address}
                  </span>
                  <span className="text-xs text-warm-600">{o.cityName}</span>
                </td>
                <td className={tdClass}>
                  {o.codReceivedAt ? <Badge tone="success">تحصّل</Badge> : o.status === "DELIVERED" ? <Badge tone="warning">عند شركة التوصيل</Badge> : <span className="text-warm-500">—</span>}
                </td>
                <td className={tdClass}>
                  <StatusBadge status={o.status} />
                  {o.trackingNumber ? (
                    <span className="mt-1 block text-xs text-warm-600" dir="ltr">
                      {o.trackingNumber}
                    </span>
                  ) : null}
                </td>
                <td className={`${tdClass} font-bold text-ink`}>{formatMAD(o.total, "ar")}</td>
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
              );
            })}
            {!orders.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-warm-600">
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
