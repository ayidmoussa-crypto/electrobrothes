import { Download, Plus, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PaymentMenu, StatusMenu, WhatsAppConfirm } from "@/components/admin/OrderRowMenus";
import { confirmationText, whatsappLink } from "@/lib/order-whatsapp";
import { PageHeader, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { filterQuery, orderWhere, parseOrderFilters } from "@/lib/admin-orders";
import { db } from "@/lib/db";
import { SOURCE_LABEL } from "@/lib/manual-order";
import { formatMAD } from "@/lib/money";
import { ORDER_STATUSES } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";
import { STATUS_LABEL } from "@/components/admin/ui";
import { TIME_ZONE } from "@/lib/time";

const PAGE = 30;
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
        prepaidAt: true,
        confirmSentAt: true,
        _count: { select: { items: true } },
        // Every line's colour, so the order can be packed straight from the list.
        items: {
          select: {
            nameAr: true,
            variantLabel: true,
            quantity: true,
            variant: { select: { colorHex: true, product: { select: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } } },
          },
        },
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
              <th className={thClass}>المبلغ</th>
              <th className={thClass}>الدفع</th>
              <th className={thClass}>الحالة</th>
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
                    <span className="relative size-12 shrink-0">
                      <span className="absolute inset-0 overflow-hidden rounded-lg bg-white">
                        {image ? <Image src={image} alt="" fill sizes="48px" unoptimized className="object-contain p-1" /> : null}
                      </span>
                      {/* The first item's colour, pinned on its picture. */}
                      {first?.variant?.colorHex ? (
                        <span
                          className="absolute -end-1 -bottom-1 size-5 rounded-full border-2 border-white shadow-sm ring-1 ring-warm-300"
                          style={{ backgroundColor: first.variant.colorHex }}
                          title={first.variantLabel ?? undefined}
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold text-ink underline-offset-4 hover:underline" dir="ltr">
                          {o.number}
                        </Link>
                        <span className="text-xs text-warm-600">{o._count.items > 1 ? `${o._count.items} منتجات` : "منتج واحد"}</span>
                      </span>
                      {first ? (
                        <span className="flex max-w-64 items-center gap-1.5 text-xs text-warm-600">
                          <span className="truncate">{first.nameAr}</span>
                          {first.variantLabel ? <b className="shrink-0 font-semibold text-ink">· {first.variantLabel}</b> : null}
                        </span>
                      ) : null}
                      {/* More than one item: each line's colour and quantity, to pack without opening the order. */}
                      {o.items.length > 1 ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {o.items.map((it, n) => (
                            <span key={n} className="inline-flex items-center gap-1 rounded-full border border-warm-200 bg-white px-1.5 py-0.5 text-[11px] text-warm-700" title={`${it.nameAr}${it.variantLabel ? ` · ${it.variantLabel}` : ""}`}>
                              {it.variant?.colorHex ? <span className="size-3 rounded-full border border-warm-300" style={{ backgroundColor: it.variant.colorHex }} aria-hidden="true" /> : null}
                              <span className="max-w-24 truncate">{it.variantLabel ?? it.nameAr}</span>×{it.quantity}
                            </span>
                          ))}
                        </span>
                      ) : null}
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
                <td className={`${tdClass} font-bold text-ink`}>{formatMAD(o.total, "ar")}</td>
                <td className={tdClass}>
                  <PaymentMenu orderId={o.id} number={o.number} status={o.status} prepaid={o.prepaidAt !== null} collected={o.codReceivedAt !== null} />
                </td>
                <td className={tdClass}>
                  <div className="flex items-start gap-1.5">
                    <StatusMenu orderId={o.id} number={o.number} status={o.status} waiting={o.confirmSentAt !== null} />
                    <WhatsAppConfirm
                      compact
                      orderId={o.id}
                      status={o.status}
                      href={whatsappLink(o.phone, confirmationText({ ...o, prepaid: o.prepaidAt !== null }))}
                    />
                  </div>
                  {o.trackingNumber ? (
                    <span className="mt-1 block text-xs text-warm-600" dir="ltr">
                      {o.trackingNumber}
                    </span>
                  ) : null}
                </td>
              </tr>
              );
            })}
            {!orders.length ? (
              <tr>
                <td colSpan={7}className="px-3 py-10 text-center text-warm-600">
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
