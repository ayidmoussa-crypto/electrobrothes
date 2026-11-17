import { ArrowRight, MessagesSquare, Phone, ShieldAlert, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setCodReceived } from "@/app/actions/admin-finance";
import { addShipmentEvent, addToBlacklist, saveShipment } from "@/app/actions/admin-orders";
import { ActionForm } from "@/components/admin/ActionForm";
import { PaymentMenu, StatusMenu, WhatsAppConfirm } from "@/components/admin/OrderRowMenus";
import { orderWhatsappHref } from "@/lib/order-whatsapp-href";
import { StatusButtons, type StatusOption } from "@/components/admin/StatusButtons";
import { inputClass, L, PageHeader, Panel, riskLabel, statusLabel } from "@/components/admin/ui";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { Badge } from "@/components/ui/Badge";
import { requireStaff } from "@/lib/admin";
import { DeleteOrders } from "@/components/admin/DeleteOrders";
import { deleteBlock } from "@/lib/order-rules";
import { agentMayMove } from "@/lib/staff-rules";
import { trackingLink } from "@/lib/carrier/webhook";
import { CARRIER_LABEL, CARRIER_STATUSES, isCarrierStatus } from "@/lib/carrier/status";
import { db } from "@/lib/db";
import { expectedFromCarrier } from "@/lib/finance";
import { channelLabel } from "@/lib/attribution";
import { sourceLabel } from "@/lib/manual-order";
import { formatMAD } from "@/lib/money";
import { allowedNext, cashToCollect, type OrderStatus } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";
import { reviewLink } from "@/lib/reviews/customer";
import { TIME_ZONE } from "@/lib/time";

const VARIANT: Record<OrderStatus, StatusOption["variant"]> = {
  NEW: "outline",
  CONFIRMED: "primary",
  SHIPPING: "dark",
  DELIVERED: "dark",
  RETURNING: "outline",
  RETURNED: "outline",
  CANCELLED: "outline",
};

export default async function OrderDetail({ params, searchParams }: PageProps<"/admin/orders/[id]">) {
  const [user, { tr, lang }] = await Promise.all([requireStaff(), adminTr()]);
  // An agent calls the customer and answers the order; money, stock cost and shipping stay with the owner.
  const agent = user.role === "AGENT";
  const dateFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const mad = (v: number) => formatMAD(v, lang);
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, logs: { orderBy: { createdAt: "asc" } }, events: { orderBy: { occurredAt: "desc" } }, city: { select: { shippingFee: true } } },
  });
  if (!order) notFound();
  const [blacklisted, otherOrders, reviewed, query, carriers] = await Promise.all([
    db.blacklist.findUnique({ where: { phone: order.phone } }),
    db.order.count({ where: { phone: order.phone, id: { not: order.id } } }),
    db.review.count({ where: { orderItem: { orderId: order.id } } }),
    searchParams,
    db.carrier.findMany({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, trackingUrl: true, lastEventAt: true, isDefault: true } }),
  ]);
  // The order's company, else the default one for a parcel not sent yet.
  const carrier = carriers.find((c) => c.id === order.carrier) ?? (order.trackingNumber ? null : carriers[0]) ?? null;
  const trackUrl = trackingLink(carrier?.trackingUrl, order.trackingNumber);
  const prepaid = order.prepaidAt !== null;
  const expected = expectedFromCarrier({ ...order, cityFee: order.city.shippingFee, prepaid });
  // Cost of the goods in this order, when every line's purchase price is known.
  const goodsCost = order.items.every((i) => i.unitCost !== null) ? order.items.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0) : null;
  const shippable = order.status === "CONFIRMED" || order.status === "SHIPPING" || order.status === "DELIVERED";
  const nextSteps = allowedNext(order.status).filter((to) => !agent || agentMayMove(order.status, to));

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-warm-600 hover:text-ink">
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden="true" />
        {tr("كل الطلبات", "All orders")}
      </Link>
      <PageHeader
        title={tr(`الطلب ${order.number}`, `Order ${order.number}`)}
        description={`${dateFmt.format(order.createdAt)} · ${tr("المصدر", "Source")}: ${sourceLabel(order.source, lang)} · ${tr("جا من", "Came from")}: ${channelLabel(order.channel, lang)}${order.channelDetail ? ` (${order.channelDetail})` : ""}`}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {agent ? null : <PaymentMenu orderId={order.id} number={order.number} status={order.status} prepaid={prepaid} collected={order.codReceivedAt !== null} />}
            <StatusMenu orderId={order.id} number={order.number} status={order.status} waiting={order.confirmSentAt !== null} agent={agent} />
            {/* Shown only when it can go (new, confirmed without a parcel, cancelled; no review): the server checks again. */}
            {!agent && !deleteBlock(order.status, order.trackingNumber, reviewed) ? <DeleteOrders ids={[order.id]} label={order.number} variant="button" /> : null}
          </div>
        }
      />
      {query.unconfirmed ? (
        <p role="alert" className="mb-4 rounded-xl border border-warning bg-warning-soft p-4 font-semibold text-warning-text">
          {tr("الطلب تسجل ولكن ما تأكدش: المخزون تبدل فنفس اللحظة. راجع الكمية وأكّدو من هنا.", "The order was saved but not confirmed: stock changed at the same moment. Check the quantity and confirm it here.")}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {order.riskScore > 0 ? (
            <div className="rounded-xl border border-warning bg-warning-soft p-4 text-warning-text">
              <p className="flex items-center gap-2 font-bold">
                <ShieldAlert className="size-5" aria-hidden="true" />
                {tr("درجة الخطورة", "Risk score")}: {order.riskScore}/100
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {order.riskFlags.map((f) => (
                  <li key={f}>
                    <Badge tone="warning">{riskLabel(f, lang)}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Panel title={tr("الزبون", "Customer")}>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-warm-600">{tr("الاسم", "Name")}</dt>
                <dd className="font-semibold text-ink">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-warm-600">{tr("الهاتف", "Phone")}</dt>
                <dd className="font-semibold text-ink" dir="ltr">
                  {formatMoroccanPhone(order.phone)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-warm-600">{tr("العنوان", "Address")}</dt>
                <dd className="text-ink">
                  {order.address}{tr("، ", ", ")}{order.cityName}
                </dd>
              </div>
              {order.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-warm-600">{tr("ملاحظات الزبون", "Customer notes")}</dt>
                  <dd className="text-ink">{order.notes}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-warm-600">{tr("طلبات سابقة بنفس الرقم", "Earlier orders, same number")}</dt>
                <dd className="text-ink">{otherOrders}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${order.phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 font-semibold text-white hover:bg-warm-900">
                <Phone className="size-4" aria-hidden="true" />
                {tr("اتصال", "Call")}
              </a>
              <WhatsAppConfirm orderId={order.id} status={order.status} href={orderWhatsappHref(order)} />
              <Link href={`/admin/inbox?phone=${encodeURIComponent(order.phone)}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-warm-200 bg-white px-4 font-semibold text-ink hover:bg-warm-50">
                <MessagesSquare className="size-4" aria-hidden="true" />
                {tr("المحادثة", "Conversation")}
              </Link>
            </div>
          </Panel>

          <Panel title={tr("المنتجات", "Products")}>
            <ul className="flex flex-col gap-2 text-sm">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 border-b border-warm-200 pb-2 last:border-0">
                  <span>
                    <span className="font-medium text-ink">{i.nameAr}</span>
                    {i.variantLabel ? <span className="text-warm-600"> · {i.variantLabel}</span> : null}
                    <span className="block text-xs text-warm-500" dir="ltr">
                      {i.sku}
                    </span>
                  </span>
                  <span className="shrink-0 text-warm-800">
                    {i.quantity} × {mad(i.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-col gap-1 border-t border-warm-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-warm-600">{tr("المجموع الفرعي", "Subtotal")}</dt>
                <dd>{mad(order.subtotal)}</dd>
              </div>
              {order.bundleDiscount ? (
                <div className="flex justify-between">
                  <dt className="text-warm-600">{tr("خصم الباك", "Bundle discount")}</dt>
                  <dd className="text-success">−{mad(order.bundleDiscount)}</dd>
                </div>
              ) : null}
              {order.discount - order.bundleDiscount ? (
                <div className="flex justify-between">
                  <dt className="text-warm-600">{tr("الخصم", "Discount")} {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                  <dd className="text-success">−{mad(order.discount - order.bundleDiscount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-warm-600">{tr("التوصيل", "Delivery")}</dt>
                <dd>{order.shippingFee ? mad(order.shippingFee) : tr("مجاني", "Free")}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="font-bold text-ink">{prepaid ? tr("المجموع (مدفوع مسبقاً)", "Total (prepaid)") : tr("المبلغ عند الاستلام", "Cash on delivery")}</dt>
                <dd className="font-extrabold text-ink">{mad(order.total)}</dd>
              </div>
              {prepaid ? (
                <div className="flex justify-between rounded-lg bg-success-soft px-2 py-1.5 font-bold text-success">
                  <dt>{tr("شركة التوصيل تجمع", "Carrier collects")}</dt>
                  <dd>{mad(cashToCollect(order.total, prepaid))}</dd>
                </div>
              ) : null}
              {agent ? null : (
                <div className="mt-2 flex justify-between border-t border-warm-200 pt-2">
                  <dt className="text-warm-600">{tr("تكلفة السلعة (لك فقط)", "Cost of goods (only you see this)")}</dt>
                  <dd>{goodsCost === null ? tr("ثمن الشراء ناقص", "Purchase price missing") : mad(goodsCost)}</dd>
                </div>
              )}
            </dl>
          </Panel>

          {agent ? null : (
          <Panel title={tr("الشحنة والتتبع", "Shipment & tracking")}>
            {shippable ? (
              <>
                <ActionForm action={saveShipment} submitLabel={tr("حفظ الشحنة", "Save shipment")} variant="dark" className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <L label={tr("شركة التوصيل", "Delivery company")}>
                    <select name="carrierId" defaultValue={carrier?.id ?? ""} className={inputClass}>
                      <option value="">{tr("— بلا شركة —", "— No company —")}</option>
                      {carriers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </L>
                  <L label={tr("رقم التتبع", "Tracking number")}>
                    <input name="trackingNumber" dir="ltr" maxLength={60} defaultValue={order.trackingNumber ?? ""} className={`${inputClass} text-start`} />
                  </L>
                  <L label={tr("الرسوم الحقيقية ديال هاد الطرد (درهم)", "Real fee for this parcel (MAD)")}>
                    <input name="carrierFee" type="number" min={0} defaultValue={order.carrierFee ?? ""} className={inputClass} />
                  </L>
                </ActionForm>

                <h3 className="mt-5 text-sm font-bold text-ink">{tr("سجّل خطوة جديدة", "Record a new step")}</h3>
                <ActionForm action={addShipmentEvent} submitLabel={tr("تسجيل الخطوة", "Record step")} className="mt-2 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <L label={tr("الخطوة", "Step")}>
                    <select name="status" className={inputClass}>
                      {CARRIER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {CARRIER_LABEL[s][lang]}
                        </option>
                      ))}
                    </select>
                  </L>
                  <L label={tr("ملاحظة (اختياري)", "Note (optional)")}>
                    <input name="note" maxLength={300} className={inputClass} />
                  </L>
                </ActionForm>
                <p className="mt-2 text-xs text-warm-600">{tr("«استلمته الشركة» كيدوز الطلب لقيد الشحن، و«تم التسليم» و«رجع» كيبدلو الحالة والمخزون بوحدهم.", "“Picked up” moves the order to shipping; “Delivered” and “Returned” change the status and stock on their own.")}</p>
              </>
            ) : (
              <p className="text-sm text-warm-600">{tr("كتبدا الشحنة من بعد تأكيد الطلب.", "The shipment starts once the order is confirmed.")}</p>
            )}

            {order.events.length ? (
              <ol className="mt-4 flex flex-col gap-3 border-s-2 border-warm-200 ps-4 text-sm">
                {order.events.map((e) => (
                  <li key={e.id}>
                    <p className="font-semibold text-ink">{isCarrierStatus(e.status) ? CARRIER_LABEL[e.status][lang] : e.status}</p>
                    <p className="text-xs text-warm-600">
                      {dateFmt.format(e.occurredAt)} · <span dir="ltr">{e.actor}</span>
                    </p>
                    {e.note ? <p className="mt-1 text-warm-800">{e.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : null}

            <p className="mt-4 flex items-start gap-2 rounded-lg bg-warm-100 p-3 text-xs text-warm-600">
              <Truck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {!carriers.length
                  ? tr("مازال ما زدتي حتى شركة توصيل: التتبع كيتسجل بيدك.", "No delivery company added yet: tracking is recorded by hand.")
                  : carrier?.lastEventAt
                    ? tr(`${carrier.name} مربوطة: الخطوات كتسجل بوحدها.`, `${carrier.name} is linked: steps are recorded on their own.`)
                    : tr("الخطوات كتسجل بوحدها ملي الشركة تبدا تصيفط لرابط الاستقبال ديالها.", "Steps are recorded on their own once the company starts calling its receiving link.")}{" "}
                <Link href="/admin/carriers" className="underline underline-offset-2">
                  {tr("شركات التوصيل", "Delivery companies")}
                </Link>
                {trackUrl ? (
                  <>
                    {" · "}
                    <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {tr("تتبع الطرد عندهم", "Track the parcel on their site")}
                    </a>
                  </>
                ) : null}
              </span>
            </p>
          </Panel>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel title={tr("تغيير الحالة", "Change status")}>
            {agent && !nextSteps.length ? (
              <p className="text-sm text-warm-600">{tr("هاد الطلب تجاوب عليه. الخطوات الجاية (الشحن والتوصيل) عند المسؤول.", "This order has been answered. The next steps (shipping, delivery) are the owner's.")}</p>
            ) : nextSteps.length ? (
              <StatusButtons
                withNote
                orderId={order.id}
                options={nextSteps.map((to) => ({ to, label: statusLabel(to, lang), variant: VARIANT[to] }))}
              />
            ) : (
              <p className="text-sm text-warm-600">{tr("الطريق العادي سالا هنا. إلا بغيتي تبدلها بيدك، استعمل قائمة الحالة فوق.", "The usual path ends here. To change it by hand, use the status menu above.")}</p>
            )}
            <p className="mt-3 text-xs text-warm-600">{tr("يُخصم المخزون عند التأكيد ويُعاد عند الإلغاء أو الإرجاع.", "Stock is taken on confirmation and given back on cancellation or return.")}</p>
          </Panel>

          {order.status === "DELIVERED" && !agent ? (
            <Panel title={tr("التحصيل من شركة التوصيل", "Collection from the carrier")}>
              <p className="mb-2 text-sm text-warm-600">{order.codReceivedAt
                  ? tr(`توصلتي بيه ${dateFmt.format(order.codReceivedAt)}.`, `Received ${dateFmt.format(order.codReceivedAt)}.`)
                  : tr(`المنتظر: ${mad(expected)}، يعني المبلغ ناقص الرسوم.`, `Expected: ${mad(expected)}, the amount minus the fee.`)}</p>
              <ActionForm action={setCodReceived} submitLabel={tr("حفظ", "Save")} variant="dark">
                <input type="hidden" name="orderId" value={order.id} />
                <L label={tr("المبلغ اللي توصلتي بيه (فارغ = مازال)", "Amount received (empty = not yet)")}>
                  <input name="amount" type="number" min={0} defaultValue={order.codReceivedAmount ?? ""} className={inputClass} />
                </L>
              </ActionForm>
            </Panel>
          ) : null}

          {order.status === "DELIVERED" ? (
            <Panel title={tr("طلب التقييم", "Review request")}>
              <p className="text-sm text-warm-600">{tr(`${reviewed} من ${order.items.length} منتجات تقيّمات.`, `${reviewed} of ${order.items.length} products reviewed.`)}</p>
              {order.reviewAskedAt ? (
                <p className="mt-1 text-sm text-warm-600">{tr(`تصيفطات الرسالة ${dateFmt.format(order.reviewAskedAt)}.`, `Request sent ${dateFmt.format(order.reviewAskedAt)}.`)}</p>
              ) : null}
              <div className="mt-2">
                <WhatsAppConfirm orderId={order.id} status={order.status} href={orderWhatsappHref(order)} />
              </div>
              <a href={reviewLink(order.id)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs text-warm-600 underline underline-offset-2">
                {tr("الرابط الخاص بهذا الطلب", "This order's own link")}
              </a>
            </Panel>
          ) : null}

          <Panel title={tr("سجل الطلب", "Order history")}>
            <ol className="flex flex-col gap-3 border-s-2 border-warm-200 ps-4 text-sm">
              {order.logs.map((l) => (
                <li key={l.id}>
                  <p className="font-semibold text-ink">{statusLabel(l.toStatus, lang)}</p>
                  <p className="text-xs text-warm-600">
                    {dateFmt.format(l.createdAt)} · <span dir="ltr">{l.actor === "customer" ? tr("الزبون", "Customer") : l.actor}</span>
                  </p>
                  {l.note ? <p className="mt-1 text-warm-800">{l.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>

          {agent ? null : (
          <Panel title={tr("القائمة السوداء", "Blacklist")}>
            {blacklisted ? (
              <p className="text-sm font-semibold text-danger">{tr("هذا الرقم في القائمة السوداء. لن يتمكن من الطلب.", "This number is on the blacklist. It cannot order.")}</p>
            ) : (
              <ActionForm action={addToBlacklist} submitLabel={tr("حظر هذا الرقم", "Block this number")} variant="outline" confirm={tr("حظر هذا الرقم من الطلب عبر الموقع؟", "Block this number from ordering on the site?")}>
                <input type="hidden" name="phone" value={order.phone} />
                <label className="flex flex-col gap-1 text-sm text-warm-600">
                  {tr("السبب", "Reason")}
                  <input name="reason" maxLength={200} className="min-h-11 admin-field rounded-lg px-3 text-base text-warm-800" />
                </label>
              </ActionForm>
            )}
          </Panel>
          )}
        </div>
      </div>
    </>
  );
}
