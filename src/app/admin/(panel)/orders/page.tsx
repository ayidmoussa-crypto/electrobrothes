import { Download, Plus, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CarrierLogo } from "@/components/admin/CarrierLogo";
import { PaymentMenu, StatusMenu, WhatsAppConfirm } from "@/components/admin/OrderRowMenus";
import { AllCheck, OrderSelectionProvider, RowCheck, SelectionBar } from "@/components/admin/OrderSelection";
import { confirmationText, whatsappLink } from "@/lib/order-whatsapp";
import { PageHeader, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/Badge";
import { requireStaff } from "@/lib/admin";
import { filterQuery, orderWhere, parseOrderFilters } from "@/lib/admin-orders";
import { db } from "@/lib/db";
import { sourceLabel } from "@/lib/manual-order";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { formatMAD } from "@/lib/money";
import { ORDER_STATUSES } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";
import { statusLabel } from "@/components/admin/ui";
import { TIME_ZONE } from "@/lib/time";

const PAGE = 30;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const [user, { tr, lang }] = await Promise.all([requireStaff(), adminTr()]);
  // Agents call customers: no export, no new orders, no payments or bulk hand-off to a carrier.
  const agent = user.role === "AGENT";
  const dateFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
  const f = parseOrderFilters(await searchParams);
  const where = orderWhere(f);
  const [orders, total, carriers] = await Promise.all([
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
        carrier: true,
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
    // All of them, to show the logo of a company even after it was switched off.
    db.carrier.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true, name: true, logoUrl: true, isDefault: true, isActive: true, trackingUrl: true } }),
  ]);
  const carrierById = new Map(carriers.map((c) => [c.id, c]));
  const trackingLink = (url: string | null, tracking: string | null) => (url && tracking ? url.replace("{tracking}", encodeURIComponent(tracking)) : null);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const input = "min-h-11 admin-field rounded-lg px-3 text-sm text-warm-800";

  return (
    <>
      <PageHeader
        title={tr("الطلبات", "Orders")}
        description={tr(`${total} طلب`, `${total} orders`)}
        actions={
          <>
            <Link href="/admin/orders/new" className={buttonClass()}>
              <Plus className="size-4" aria-hidden="true" />
              {tr("إضافة طلب", "New order")}
            </Link>
            {agent ? null : <a href={`/admin/orders/export${filterQuery({ ...f, page: 1 })}`} className={buttonClass({ variant: "dark" })}>
              <Download className="size-4" aria-hidden="true" />
              {tr("تصدير CSV لشركة التوصيل", "Export CSV for the carrier")}
            </a>}
          </>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 admin-card p-3">
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          {tr("بحث", "Search")}
          <input name="q" defaultValue={f.q} placeholder={tr("رقم الطلب، التتبع، الاسم أو الهاتف", "Order number, tracking, name or phone")} className={`${input} w-56`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          {tr("الحالة", "Status")}
          <select name="status" defaultValue={f.status ?? ""} className={input}>
            <option value="">{tr("الكل", "All")}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          {tr("من", "From")}
          <input type="date" name="from" defaultValue={f.from} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          {tr("إلى", "To")}
          <input type="date" name="to" defaultValue={f.to} className={input} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-warm-800">
          <input type="checkbox" name="risky" value="1" defaultChecked={f.risky} className="size-5 accent-ink" />
          {tr("المشبوهة فقط", "Suspicious only")}
        </label>
        <button type="submit" className={buttonClass()}>
          {tr("تصفية", "Filter")}
        </button>
        <Link href="/admin/orders" className={buttonClass({ variant: "ghost" })}>
          {tr("مسح", "Clear")}
        </Link>
      </form>

      <OrderSelectionProvider ids={orders.map((o) => o.id)}>
      <div className="overflow-x-auto admin-card">
        <table className="w-full min-w-[72rem]">
          <thead className="border-b border-white/70 bg-white/45">
            <tr>
              {agent ? null : (
                <th className={`${thClass} w-10`}>
                  <AllCheck />
                </th>
              )}
              <th className={thClass}>{tr("الطلب", "Order")}</th>
              <th className={thClass}>{tr("التاريخ", "Date")}</th>
              <th className={thClass}>{tr("الزبون", "Customer")}</th>
              <th className={thClass}>{tr("العنوان", "Address")}</th>
              <th className={thClass}>{tr("المبلغ", "Amount")}</th>
              {agent ? null : <th className={thClass}>{tr("الدفع", "Payment")}</th>}
              <th className={thClass}>{tr("الحالة", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const first = o.items[0];
              const image = first?.variant?.product.images[0]?.url;
              return (
              <tr key={o.id} className="border-b border-warm-200/60 last:border-0 transition-colors hover:bg-white/60">
                {agent ? null : (
                  <td className={tdClass}>
                    <RowCheck id={o.id} number={o.number} />
                  </td>
                )}
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
                        <span className="text-xs text-warm-600">{o._count.items > 1 ? tr(`${o._count.items} منتجات`, `${o._count.items} items`) : tr("منتج واحد", "1 item")}</span>
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
                        {o.source !== "WEBSITE" ? <Badge tone="neutral">{sourceLabel(o.source, lang)}</Badge> : null}
                        {o.riskScore >= 30 ? (
                          <Badge tone="warning" icon={<ShieldAlert className="size-3.5" aria-hidden="true" />}>
                            {tr("مشبوه", "Risk")} {o.riskScore}
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
                <td className={`${tdClass} font-bold text-ink`}>{formatMAD(o.total, lang)}</td>
                {agent ? null : (
                  <td className={tdClass}>
                    <PaymentMenu orderId={o.id} number={o.number} status={o.status} prepaid={o.prepaidAt !== null} collected={o.codReceivedAt !== null} />
                  </td>
                )}
                <td className={tdClass}>
                  <div className="flex items-start gap-1.5">
                    <StatusMenu orderId={o.id} number={o.number} status={o.status} waiting={o.confirmSentAt !== null} agent={agent} />
                    <WhatsAppConfirm
                      compact
                      orderId={o.id}
                      status={o.status}
                      href={whatsappLink(o.phone, confirmationText({ ...o, prepaid: o.prepaidAt !== null }))}
                    />
                    {/* The delivery company holding this order; an empty ring until one is picked. */}
                    {(() => {
                      const c = o.carrier ? carrierById.get(o.carrier) : undefined;
                      if (!c) return <span className="size-8 shrink-0 rounded-full border-2 border-dashed border-warm-300" title={tr("مازال ما عندها شركة توصيل", "No delivery company yet")} aria-hidden="true" />;
                      const label = `${c.name}${o.trackingNumber ? ` · ${o.trackingNumber}` : ""}`;
                      const link = trackingLink(c.trackingUrl, o.trackingNumber);
                      return link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" title={label} aria-label={label} className="rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
                          <CarrierLogo name={c.name} logoUrl={c.logoUrl} />
                        </a>
                      ) : (
                        <span title={label} aria-label={label} role="img">
                          <CarrierLogo name={c.name} logoUrl={c.logoUrl} />
                        </span>
                      );
                    })()}
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
                <td colSpan={agent ? 6 : 8} className="px-3 py-10 text-center text-warm-600">
                  {tr("لا توجد طلبات مطابقة.", "No matching orders.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {agent ? null : (
        <SelectionBar
          orders={orders.map((o) => ({ id: o.id, number: o.number, customerName: o.customerName, cityName: o.cityName, status: o.status, trackingNumber: o.trackingNumber }))}
          carriers={carriers.filter((c) => c.isActive).map(({ id, name, logoUrl, isDefault }) => ({ id, name, logoUrl, isDefault }))}
        />
      )}
      </OrderSelectionProvider>

      {pages > 1 ? (
        <nav aria-label={tr("الصفحات", "Pages")} className="mt-4 flex flex-wrap gap-1">
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
