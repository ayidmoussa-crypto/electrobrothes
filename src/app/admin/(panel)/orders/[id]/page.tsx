import { ArrowRight, MessageCircle, MessagesSquare, Phone, ShieldAlert, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setCodReceived } from "@/app/actions/admin-finance";
import { addShipmentEvent, addToBlacklist, saveShipment } from "@/app/actions/admin-orders";
import { ActionForm } from "@/components/admin/ActionForm";
import { StatusButtons, type StatusOption } from "@/components/admin/StatusButtons";
import { inputClass, L, PageHeader, Panel, RISK_LABEL, STATUS_LABEL, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { CARRIER_NAME, CARRIER_TRACKING_PAGE, carrierHasLogin } from "@/lib/carrier/connection";
import { CARRIER_LABEL, CARRIER_STATUSES, isCarrierStatus } from "@/lib/carrier/status";
import { db } from "@/lib/db";
import { expectedFromCarrier } from "@/lib/finance";
import { channelLabel } from "@/lib/attribution";
import { SOURCE_LABEL } from "@/lib/manual-order";
import { formatMAD } from "@/lib/money";
import { allowedNext, type OrderStatus } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";
import { reviewLink } from "@/lib/reviews/customer";
import { reviewWhatsappMessage } from "@/lib/reviews/rules";
import { TIME_ZONE } from "@/lib/time";

const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
const VARIANT: Record<OrderStatus, StatusOption["variant"]> = {
  NEW: "outline",
  CONFIRMED: "primary",
  SHIPPING: "dark",
  DELIVERED: "dark",
  RETURNED: "outline",
  CANCELLED: "outline",
};

export default async function OrderDetail({ params, searchParams }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, logs: { orderBy: { createdAt: "asc" } }, events: { orderBy: { occurredAt: "desc" } }, city: { select: { shippingFee: true } } },
  });
  if (!order) notFound();
  const [blacklisted, otherOrders, reviewed, query] = await Promise.all([
    db.blacklist.findUnique({ where: { phone: order.phone } }),
    db.order.count({ where: { phone: order.phone, id: { not: order.id } } }),
    db.review.count({ where: { orderItem: { orderId: order.id } } }),
    searchParams,
  ]);
  const expected = expectedFromCarrier({ ...order, cityFee: order.city.shippingFee });
  // Cost of the goods in this order, when every line's purchase price is known.
  const goodsCost = order.items.every((i) => i.unitCost !== null) ? order.items.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0) : null;
  const shippable = order.status === "CONFIRMED" || order.status === "SHIPPING" || order.status === "DELIVERED";

  const waNumber = order.phone.replace("+", "");
  const waText = encodeURIComponent(
    `السلام عليكم ${order.customerName}، معك ElectroBrothers بخصوص طلبك ${order.number} بمبلغ ${order.total} درهم. هل تؤكد الطلب والعنوان: ${order.address}، ${order.cityName}؟`,
  );

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-warm-600 hover:text-ink">
        <ArrowRight className="size-4" aria-hidden="true" />
        كل الطلبات
      </Link>
      <PageHeader
        title={`الطلب ${order.number}`}
        description={`${dateFmt.format(order.createdAt)} · المصدر: ${SOURCE_LABEL[order.source]} · جا من: ${channelLabel(order.channel)}${order.channelDetail ? ` (${order.channelDetail})` : ""}`}
        actions={<StatusBadge status={order.status} />}
      />
      {query.unconfirmed ? (
        <p role="alert" className="mb-4 rounded-xl border border-warning bg-warning-soft p-4 font-semibold text-warning-text">
          الطلب تسجل ولكن ما تأكدش: المخزون تبدل فنفس اللحظة. راجع الكمية وأكّدو من هنا.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {order.riskScore > 0 ? (
            <div className="rounded-xl border border-warning bg-warning-soft p-4 text-warning-text">
              <p className="flex items-center gap-2 font-bold">
                <ShieldAlert className="size-5" aria-hidden="true" />
                درجة الخطورة: {order.riskScore}/100
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {order.riskFlags.map((f) => (
                  <li key={f}>
                    <Badge tone="warning">{RISK_LABEL[f] ?? f}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Panel title="الزبون">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-warm-600">الاسم</dt>
                <dd className="font-semibold text-ink">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-warm-600">الهاتف</dt>
                <dd className="font-semibold text-ink" dir="ltr">
                  {formatMoroccanPhone(order.phone)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-warm-600">العنوان</dt>
                <dd className="text-ink">
                  {order.address}، {order.cityName}
                </dd>
              </div>
              {order.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-warm-600">ملاحظات الزبون</dt>
                  <dd className="text-ink">{order.notes}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-warm-600">طلبات سابقة بنفس الرقم</dt>
                <dd className="text-ink">{otherOrders}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${order.phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 font-semibold text-white hover:bg-warm-900">
                <Phone className="size-4" aria-hidden="true" />
                اتصال
              </a>
              <a
                href={`https://wa.me/${waNumber}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-whatsapp px-4 font-semibold text-ink hover:opacity-90"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                تأكيد عبر واتساب
              </a>
              <Link href={`/admin/inbox?phone=${encodeURIComponent(order.phone)}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-warm-200 bg-white px-4 font-semibold text-ink hover:bg-warm-50">
                <MessagesSquare className="size-4" aria-hidden="true" />
                المحادثة
              </Link>
            </div>
          </Panel>

          <Panel title="المنتجات">
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
                    {i.quantity} × {formatMAD(i.unitPrice, "ar")}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-col gap-1 border-t border-warm-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-warm-600">المجموع الفرعي</dt>
                <dd>{formatMAD(order.subtotal, "ar")}</dd>
              </div>
              {order.bundleDiscount ? (
                <div className="flex justify-between">
                  <dt className="text-warm-600">خصم الباك</dt>
                  <dd className="text-success">−{formatMAD(order.bundleDiscount, "ar")}</dd>
                </div>
              ) : null}
              {order.discount - order.bundleDiscount ? (
                <div className="flex justify-between">
                  <dt className="text-warm-600">الخصم {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                  <dd className="text-success">−{formatMAD(order.discount - order.bundleDiscount, "ar")}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-warm-600">التوصيل</dt>
                <dd>{order.shippingFee ? formatMAD(order.shippingFee, "ar") : "مجاني"}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="font-bold text-ink">المبلغ عند الاستلام</dt>
                <dd className="font-extrabold text-ink">{formatMAD(order.total, "ar")}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-warm-200 pt-2">
                <dt className="text-warm-600">تكلفة السلعة (لك فقط)</dt>
                <dd>{goodsCost === null ? "ثمن الشراء ناقص" : formatMAD(goodsCost, "ar")}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="الشحنة والتتبع">
            {shippable ? (
              <>
                <ActionForm action={saveShipment} submitLabel="حفظ الشحنة" variant="dark" className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <L label={`رقم التتبع (${CARRIER_NAME})`}>
                    <input name="trackingNumber" dir="ltr" maxLength={60} defaultValue={order.trackingNumber ?? ""} className={`${inputClass} text-start`} />
                  </L>
                  <L label="الرسوم الحقيقية ديال هاد الطرد (درهم)">
                    <input name="carrierFee" type="number" min={0} defaultValue={order.carrierFee ?? ""} className={inputClass} />
                  </L>
                </ActionForm>

                <h3 className="mt-5 text-sm font-bold text-ink">سجّل خطوة جديدة</h3>
                <ActionForm action={addShipmentEvent} submitLabel="تسجيل الخطوة" className="mt-2 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <L label="الخطوة">
                    <select name="status" className={inputClass}>
                      {CARRIER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {CARRIER_LABEL[s].ar}
                        </option>
                      ))}
                    </select>
                  </L>
                  <L label="ملاحظة (اختياري)">
                    <input name="note" maxLength={300} className={inputClass} />
                  </L>
                </ActionForm>
                <p className="mt-2 text-xs text-warm-600">«استلمته الشركة» كيدوز الطلب لقيد الشحن، و«تم التسليم» و«رجع» كيبدلو الحالة والمخزون بوحدهم.</p>
              </>
            ) : (
              <p className="text-sm text-warm-600">كتبدا الشحنة من بعد تأكيد الطلب.</p>
            )}

            {order.events.length ? (
              <ol className="mt-4 flex flex-col gap-3 border-s-2 border-warm-200 ps-4 text-sm">
                {order.events.map((e) => (
                  <li key={e.id}>
                    <p className="font-semibold text-ink">{isCarrierStatus(e.status) ? CARRIER_LABEL[e.status].ar : e.status}</p>
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
                {carrierHasLogin() ? "بيانات الدخول كاينين، والربط المباشر كيتسنى وثائق API من الشركة." : "الربط المباشر مع Express Relais كيتسنى بيانات الدخول ووثائق API من الشركة."} دابا التتبع كيتسجل بيدك.{" "}
                <a href={CARRIER_TRACKING_PAGE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  صفحة التتبع ديال الشركة
                </a>
              </span>
            </p>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="تغيير الحالة">
            {allowedNext(order.status).length ? (
              <StatusButtons
                withNote
                orderId={order.id}
                options={allowedNext(order.status).map((to) => ({ to, label: STATUS_LABEL[to], variant: VARIANT[to] }))}
              />
            ) : (
              <p className="text-sm text-warm-600">هذه حالة نهائية.</p>
            )}
            <p className="mt-3 text-xs text-warm-600">يُخصم المخزون عند التأكيد ويُعاد عند الإلغاء أو الإرجاع.</p>
          </Panel>

          {order.status === "DELIVERED" ? (
            <Panel title="التحصيل من شركة التوصيل">
              <p className="mb-2 text-sm text-warm-600">{order.codReceivedAt ? `توصلتي بيه ${dateFmt.format(order.codReceivedAt)}.` : `المنتظر: ${formatMAD(expected, "ar")}، يعني المبلغ ناقص الرسوم.`}</p>
              <ActionForm action={setCodReceived} submitLabel="حفظ" variant="dark">
                <input type="hidden" name="orderId" value={order.id} />
                <L label="المبلغ اللي توصلتي بيه (فارغ = مازال)">
                  <input name="amount" type="number" min={0} defaultValue={order.codReceivedAmount ?? ""} className={inputClass} />
                </L>
              </ActionForm>
            </Panel>
          ) : null}

          {order.status === "DELIVERED" ? (
            <Panel title="طلب التقييم">
              <p className="text-sm text-warm-600">{reviewed} من {order.items.length} منتجات تقيّمات.</p>
              <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(reviewWhatsappMessage(order.customerName, order.number, reviewLink(order.id)))}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-whatsapp px-4 font-semibold text-ink hover:opacity-90">
                <MessageCircle className="size-4" aria-hidden="true" />
                رسالة التقييم فواتساب
              </a>
              <a href={reviewLink(order.id)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs text-warm-600 underline underline-offset-2">
                الرابط الخاص بهذا الطلب
              </a>
            </Panel>
          ) : null}

          <Panel title="سجل الطلب">
            <ol className="flex flex-col gap-3 border-s-2 border-warm-200 ps-4 text-sm">
              {order.logs.map((l) => (
                <li key={l.id}>
                  <p className="font-semibold text-ink">{STATUS_LABEL[l.toStatus]}</p>
                  <p className="text-xs text-warm-600">
                    {dateFmt.format(l.createdAt)} · <span dir="ltr">{l.actor === "customer" ? "الزبون" : l.actor}</span>
                  </p>
                  {l.note ? <p className="mt-1 text-warm-800">{l.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="القائمة السوداء">
            {blacklisted ? (
              <p className="text-sm font-semibold text-danger">هذا الرقم في القائمة السوداء. لن يتمكن من الطلب.</p>
            ) : (
              <ActionForm action={addToBlacklist} submitLabel="حظر هذا الرقم" variant="outline" confirm="حظر هذا الرقم من الطلب عبر الموقع؟">
                <input type="hidden" name="phone" value={order.phone} />
                <label className="flex flex-col gap-1 text-sm text-warm-600">
                  السبب
                  <input name="reason" maxLength={200} className="min-h-11 admin-field rounded-lg px-3 text-base text-warm-800" />
                </label>
              </ActionForm>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
