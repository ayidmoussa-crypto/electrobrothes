import { ArrowRight, MessageCircle, Phone, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addToBlacklist } from "@/app/actions/admin-orders";
import { ActionForm } from "@/components/admin/ActionForm";
import { StatusButtons, type StatusOption } from "@/components/admin/StatusButtons";
import { PageHeader, Panel, RISK_LABEL, STATUS_LABEL, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { allowedNext, type OrderStatus } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";

const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" });
const VARIANT: Record<OrderStatus, StatusOption["variant"]> = {
  NEW: "outline",
  CONFIRMED: "primary",
  SHIPPING: "dark",
  DELIVERED: "dark",
  RETURNED: "outline",
  CANCELLED: "outline",
};

export default async function OrderDetail({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, logs: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();
  const [blacklisted, otherOrders] = await Promise.all([
    db.blacklist.findUnique({ where: { phone: order.phone } }),
    db.order.count({ where: { phone: order.phone, id: { not: order.id } } }),
  ]);

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
      <PageHeader title={`الطلب ${order.number}`} description={dateFmt.format(order.createdAt)} actions={<StatusBadge status={order.status} />} />

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
              {order.discount ? (
                <div className="flex justify-between">
                  <dt className="text-warm-600">الخصم {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                  <dd className="text-success">−{formatMAD(order.discount, "ar")}</dd>
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
            </dl>
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

          <Panel title="سجل الطلب">
            <ol className="flex flex-col gap-3 border-s-2 border-warm-200 ps-4 text-sm">
              {order.logs.map((l) => (
                <li key={l.id}>
                  <p className="font-semibold text-ink">{STATUS_LABEL[l.toStatus]}</p>
                  <p className="text-xs text-warm-600">
                    {dateFmt.format(l.createdAt)} · <span dir="ltr">{l.actor}</span>
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
