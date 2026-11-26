import { erEnvOf } from "@/lib/carrier/expressrelais-send";
import { DateField } from "@/components/ui/DateField";
import { Select } from "@/components/ui/Select";
import { Columns3, Download, Plus, Rows3, Search, ShieldAlert, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CarrierLogo } from "@/components/admin/CarrierLogo";
import { PaymentMenu, StatusMenu, WhatsAppConfirm } from "@/components/admin/OrderRowMenus";
import { AllCheck, OrderSelectionProvider, RowCheck, SelectionBar } from "@/components/admin/OrderSelection";
import { orderWhatsappHref } from "@/lib/order-whatsapp-href";
import { Pagination } from "@/components/admin/Pagination";
import { RefreshStatuses } from "@/components/admin/RefreshStatuses";
import { PageHeader, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/Badge";
import { requireStaff } from "@/lib/admin";
import { ageLabel, filterQuery, orderWhere, parseOrderFilters, type OrderFilters } from "@/lib/admin-orders";
import { OrderBoard, type BoardColumn, type BoardOrder } from "@/components/admin/OrderBoard";
import { OrderCards } from "@/components/admin/OrderCards";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { orderSourceLabel } from "@/lib/manual-order";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { formatMAD } from "@/lib/money";
import { deleteBlock, ORDER_STATUSES, type OrderStatus } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";
import { statusLabel } from "@/components/admin/ui";
import { TIME_ZONE } from "@/lib/time";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("الطلبات", "Orders");

const PAGE = 30;
/** Columns of the board, in the order an order travels; cancelled last. */
const BOARD_ORDER: OrderStatus[] = ["NEW", "CONFIRMED", "SHIPPING", "DELIVERED", "RETURNING", "RETURNED", "CANCELLED"];
/** Cards per column; the rest are one click away in the list. */
const BOARD_CARDS = 40;

const orderCard = {
  id: true,
  channel: true,
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
} satisfies Prisma.OrderSelect;

async function loadBoard(f: OrderFilters) {
  const where = orderWhere(f);
  const [sums, ...lists] = await Promise.all([
    db.order.groupBy({ by: ["status"], where, _count: true, _sum: { total: true } }),
    ...BOARD_ORDER.map((status) => db.order.findMany({ where: { ...where, status }, orderBy: { createdAt: "desc" }, take: BOARD_CARDS, select: orderCard })),
  ]);
  return { sums, lists };
}

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const [user, { tr, lang }] = await Promise.all([requireStaff(), adminTr()]);
  // Agents call customers: no export, no new orders, no payments or bulk hand-off to a carrier.
  const agent = user.role === "AGENT";
  const dateFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
  const f = parseOrderFilters(await searchParams);
  const where = orderWhere(f);
  const [orders, total, carriers, cityCounts] = await Promise.all([
    db.order.findMany({
      where,
      // Waiting for a review request: the oldest delivery first, the one closest to dropping off the list.
      orderBy: f.reviewAsk ? { deliveredAt: "asc" } : { createdAt: "desc" },
      skip: (f.page - 1) * PAGE,
      take: PAGE,
      select: orderCard,
    }),
    db.order.count({ where }),
    // All of them, to show the logo of a company even after it was switched off.
    db.carrier.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true, name: true, logoUrl: true, isDefault: true, isActive: true, trackingUrl: true, apiBaseUrl: true } }),
    // The cities that have orders, the busiest first: the city filter lists only these.
    db.order.groupBy({ by: ["cityId"], _count: true, orderBy: { _count: { cityId: "desc" } } }),
  ]);
  const cityNames = await db.city.findMany({ where: { id: { in: cityCounts.map((c) => c.cityId) } }, select: { id: true, nameAr: true, nameEn: true } });
  const cityName = new Map(cityNames.map((c) => [c.id, lang === "en" ? c.nameEn : c.nameAr]));
  const cityOptions = cityCounts.flatMap((c) => (cityName.has(c.cityId) ? [{ id: c.cityId, name: cityName.get(c.cityId)!, count: c._count }] : []));
  const carrierById = new Map(carriers.map((c) => [c.id, c]));

  // Board (desktop, ?view=board): the latest orders of each status, with every column's count and money.
  // The same filters apply, except the status, which is the column.
  const board = f.view === "board" ? await loadBoard({ ...f, status: undefined }) : null;
  const now = new Date();
  const when = (d: Date) => ageLabel(d, now, adminLocale(lang), TIME_ZONE);
  /** One order as a card: the board's columns (desktop) and the list on phones. */
  const toCard = (o: (typeof orders)[number]): BoardOrder => {
    const first = o.items[0];
    const c = o.carrier ? carrierById.get(o.carrier) : undefined;
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      total: o.total,
      customerName: o.customerName,
      cityName: o.cityName,
      phone: o.phone,
      when: when(o.createdAt),
      image: first?.variant?.product.images[0]?.url ?? null,
      name: first?.nameAr ?? null,
      variantLabel: first?.variantLabel ?? null,
      colorHex: first?.variant?.colorHex ?? null,
      more: Math.max(0, o._count.items - 1),
      waiting: o.confirmSentAt !== null,
      risky: o.riskScore >= 30 ? o.riskScore : null,
      source: o.source !== "WEBSITE" ? orderSourceLabel(o, lang) : null,
      waHref: orderWhatsappHref(o),
      carrier: c ? { name: c.name, logoUrl: c.logoUrl } : null,
      // Reviews only come after delivery, which deleteBlock refuses already; the server checks them again.
      canDelete: !deleteBlock(o.status, o.trackingNumber, 0),
    };
  };
  const columns: BoardColumn[] | null = board
    ? BOARD_ORDER.map((status, i) => {
        const sum = board.sums.find((s) => s.status === status);
        return {
          status,
          count: sum?._count ?? 0,
          total: sum?._sum.total ?? 0,
          listHref: `/admin/orders${filterQuery({ ...f, status, view: undefined, page: 1 })}`,
          orders: board.lists[i].map(toCard),
        };
      })
    : null;
  // Phones: the page's orders as cards, under a heading per day (today, yesterday, then the date).
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
  const dayName = new Intl.DateTimeFormat(adminLocale(lang), { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE });
  const today = dayOf.format(now);
  const yesterday = dayOf.format(new Date(now.getTime() - 86_400_000));
  const days: { key: string; label: string; orders: BoardOrder[] }[] = [];
  for (const o of orders) {
    const key = dayOf.format(o.createdAt);
    let day = days.at(-1);
    if (day?.key !== key) {
      day = { key, label: key === today ? tr("اليوم", "Today") : key === yesterday ? tr("البارح", "Yesterday") : dayName.format(o.createdAt), orders: [] };
      days.push(day);
    }
    day.orders.push(toCard(o));
  }
  // Every order on screen that can be ticked: the board's cards, or the list's rows (desktop only; phones have no ticks).
  const shown = board ? board.lists.flat() : orders;
  const trackingLink =(url: string | null, tracking: string | null) => (url && tracking ? url.replace("{tracking}", encodeURIComponent(tracking)) : null);
  const input = "min-h-11 admin-field rounded-lg px-3 text-sm text-warm-800";

  return (
    <>
      <PageHeader
        title={tr("الطلبات", "Orders")}
        description={tr(`${total} طلب`, `${total} orders`)}
        actions={
          <>
            {/* List or board: the board is for wide screens, so phones keep the list. */}
            <nav aria-label={tr("طريقة العرض", "View")} className="hidden rounded-full bg-warm-100 p-1 lg:flex">
              {[
                { view: undefined, label: tr("قائمة", "List"), icon: Rows3 },
                { view: "board" as const, label: tr("لوحة", "Board"), icon: Columns3 },
              ].map(({ view, label, icon: Icon }) => (
                <Link
                  key={label}
                  href={`/admin/orders${filterQuery({ ...f, view, page: 1 })}`}
                  aria-current={f.view === view ? "page" : undefined}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${f.view === view ? "bg-ink text-white" : "text-warm-700 hover:bg-white hover:text-ink"}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </nav>
            {/* Phones get the round button over the list instead. */}
            <Link href="/admin/orders/new" className={buttonClass({ className: "max-lg:hidden" })}>
              <Plus className="size-4" aria-hidden="true" />
              {tr("إضافة طلب", "New order")}
            </Link>
            {!agent && carriers.some((c) => c.isActive && erEnvOf(c.apiBaseUrl)) ? <RefreshStatuses /> : null}
            {/* The carrier's CSV is a desk job: desktop only. */}
            {agent ? null : <a href={`/admin/orders/export${filterQuery({ ...f, page: 1 })}`} className={buttonClass({ variant: "dark", className: "max-lg:hidden" })}>
              <Download className="size-4" aria-hidden="true" />
              {tr("تصدير CSV لشركة التوصيل", "Export CSV for the carrier")}
            </a>}
          </>
        }
      />

      {/* Phones: the search on its own row, then status, city and a search button; the dates and "suspicious only" are on desktop. */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 admin-card p-2 lg:p-3">
        {f.view ? <input type="hidden" name="view" value={f.view} /> : null}
        <label className="flex min-w-0 flex-col gap-1 text-xs text-warm-600 max-lg:basis-full">
          <span className="max-lg:sr-only">{tr("بحث", "Search")}</span>
          <input name="q" type="search" defaultValue={f.q} placeholder={tr("رقم الطلب، التتبع، الاسم أو الهاتف", "Order number, tracking, name or phone")} className={`${input} w-56 max-lg:w-full`} />
        </label>
        {/* On the board each status is a column already. */}
        <label className={`flex min-w-0 flex-col gap-1 text-xs text-warm-600 max-lg:flex-1 ${board ? "lg:hidden" : ""}`}>
          <span className="max-lg:sr-only">{tr("الحالة", "Status")}</span>
          <Select name="status" defaultValue={f.status ?? ""} className={`${input} max-lg:w-full`}>
            <option value="">{tr("الكل", "All")}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, lang)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-warm-600 max-lg:flex-1">
          <span className="max-lg:sr-only">{tr("المدينة", "City")}</span>
          <Select name="city" defaultValue={f.city ?? ""} className={`${input} max-lg:w-full lg:max-w-48`}>
            <option value="">{tr("كل المدن", "All cities")}</option>
            {cityOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.count})
              </option>
            ))}
          </Select>
        </label>
        {/* Hidden on phones, but a date chosen on desktop still travels with the search. */}
        <label className="flex flex-col gap-1 text-xs text-warm-600 max-lg:hidden">
          {tr("من", "From")}
          <DateField name="from" defaultValue={f.from} className={input} lang={lang} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600 max-lg:hidden">
          {tr("إلى", "To")}
          <DateField name="to" defaultValue={f.to} className={input} lang={lang} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-warm-800 max-lg:hidden">
          <input type="checkbox" name="risky" value="1" defaultChecked={f.risky} className="size-5 accent-ink" />
          {tr("المشبوهة فقط", "Suspicious only")}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-warm-800 max-lg:hidden">
          <input type="checkbox" name="review" value="ask" defaultChecked={f.reviewAsk} className="size-5 accent-ink" />
          {tr("كيتسناو طلب التقييم", "Awaiting a review request")}
        </label>
        <button type="submit" aria-label={tr("تصفية", "Filter")} className={buttonClass({ className: "shrink-0 max-lg:size-11! max-lg:px-0!" })}>
          <Search className="size-4.5 lg:hidden" aria-hidden="true" />
          <span className="max-lg:hidden">{tr("تصفية", "Filter")}</span>
        </button>
        {/* Phones show "clear" only when something is filtered. */}
        <Link
          href={`/admin/orders${filterQuery({ page: 1, view: f.view })}`}
          aria-label={tr("مسح", "Clear")}
          className={buttonClass({ variant: "ghost", className: `shrink-0 max-lg:size-11! max-lg:px-0! ${f.q || f.status || f.city || f.from || f.to || f.risky || f.reviewAsk ? "" : "max-lg:hidden"}` })}
        >
          <X className="size-4.5 lg:hidden" aria-hidden="true" />
          <span className="max-lg:hidden">{tr("مسح", "Clear")}</span>
        </Link>
      </form>

      <OrderSelectionProvider ids={shown.map((o) => o.id)}>
      {columns ? (
        <div className="hidden lg:block">
          <OrderBoard columns={columns} agent={agent} />
        </div>
      ) : null}
      {/* Phones: cards by day, each swiped aside to call. */}
      <div className="lg:hidden">
        <OrderCards days={days} agent={agent} />
      </div>
      {/* Desktop list (the board replaces it when chosen). */}
      <div className={`overflow-x-auto admin-card max-lg:hidden ${columns ? "lg:hidden" : ""}`}>
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
                        {o.source !== "WEBSITE" ? <Badge tone="neutral">{orderSourceLabel(o, lang)}</Badge> : null}
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
                      href={orderWhatsappHref(o)}
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
          orders={shown.map((o) => ({ id: o.id, number: o.number, customerName: o.customerName, cityName: o.cityName, status: o.status, trackingNumber: o.trackingNumber }))}
          carriers={carriers.filter((c) => c.isActive).map(({ id, name, logoUrl, isDefault, apiBaseUrl }) => ({ id, name, logoUrl, isDefault, connected: erEnvOf(apiBaseUrl) !== null }))}
        />
      )}
      </OrderSelectionProvider>

      <Pagination page={f.page} total={total} size={PAGE} href={(n) => `/admin/orders${filterQuery({ ...f, page: n })}`} tr={tr} className={board ? "lg:hidden" : ""} />
    </>
  );
}
