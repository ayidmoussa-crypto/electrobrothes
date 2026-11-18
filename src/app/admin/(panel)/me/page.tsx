import { CheckCircle2, PhoneCall, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MonthPills, monthTitle } from "@/components/admin/MonthPills";
import { PageHeader, Panel, Stat, StatusBadge, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { handledOrders, loadBalances, recentPayments } from "@/lib/staff";
import { agentStats, monthRange } from "@/lib/staff-rules";
import { TIME_ZONE } from "@/lib/time";

/** A confirmation agent's month: what they answered, confirmed, got delivered, and earned. */
export default async function MyFigures({ searchParams }: PageProps<"/admin/me">) {
  const [user, { tr, lang }] = await Promise.all([requireStaff(), adminTr()]);
  // The owner reads every agent's figures on the team page.
  if (user.role === "OWNER") redirect("/admin/staff");
  const q = await searchParams;
  const { start, end, key } = monthRange(typeof q.month === "string" ? q.month : undefined);
  const [rows, waiting, balanceOf, payments] = await Promise.all([handledOrders(user.id, start, end), db.order.count({ where: { status: "NEW" } }), loadBalances(undefined, user.id), recentPayments(user.id)]);
  const s = agentStats(rows, user);
  const due = Math.max(0, balanceOf(user).amount);
  const lastPayment = payments[0];
  const mad = (v: number) => formatMAD(v, lang);
  const dateFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
  const pct = (v: number | null) => (v === null ? tr("لا توجد بيانات بعد", "No data yet") : `${v}%`);

  return (
    <>
      <PageHeader title={tr(`مرحبا ${user.name}`, `Hello ${user.name}`)} description={monthTitle(key, lang)} actions={<MonthPills basePath="/admin/me" current={key} lang={lang} />} />

      {waiting ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 admin-card p-4">
          <p className="font-semibold text-ink">{tr(`${waiting} طلب جديد كيتسنا الاتصال.`, `${waiting} new orders waiting for a call.`)}</p>
          <Link href="/admin/orders?status=NEW" className={buttonClass()}>
            <PhoneCall className="size-4" aria-hidden="true" />
            {tr("بدا الاتصال", "Start calling")}
          </Link>
        </div>
      ) : null}

      <div className="mb-3 admin-card p-4">
        <p className="text-xs font-semibold text-warm-600">{tr("اللي مازال ما تخلص ليك", "Still to be paid to you")}</p>
        <p className="text-3xl font-extrabold text-ink">{mad(due)}</p>
        {lastPayment ? <p className="mt-1 text-xs text-warm-600">{tr(`آخر خلصة: ${mad(lastPayment.amount)} · ${dateFmt.format(lastPayment.paidAt)}`, `Last payment: ${mad(lastPayment.amount)} · ${dateFmt.format(lastPayment.paidAt)}`)}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Wallet}
          label={tr("ربح هاد الشهر", "This month's earnings")}
          value={mad(s.earnings)}
          hint={tr(`${s.confirmed} تأكيد × ${user.payPerConfirmed} + ${s.delivered} توصيل × ${user.payPerDelivered}`, `${s.confirmed} confirmed × ${user.payPerConfirmed} + ${s.delivered} delivered × ${user.payPerDelivered}`)}
        />
        <Stat icon={CheckCircle2} label={tr("طلبات أكدتيها", "Orders you confirmed")} value={String(s.confirmed)} hint={tr(`من ${s.handled} طلب جاوبتي عليه`, `of ${s.handled} orders you answered`)} />
        <Stat icon={PhoneCall} label={tr("نسبة التأكيد", "Confirmation rate")} value={pct(s.confirmation)} empty={s.confirmation === null} hint={tr(`${s.cancelled} ملغى`, `${s.cancelled} cancelled`)} />
        <Stat
          icon={Truck}
          label={tr("نسبة التوصيل", "Delivery rate")}
          value={pct(s.delivery)}
          empty={s.delivery === null}
          hint={tr(`${s.delivered} توصل · ${s.returned} رجع · ${s.onTheWay} فالطريق`, `${s.delivered} delivered · ${s.returned} returned · ${s.onTheWay} on the way`)}
        />
      </div>
      <p className="mt-2 text-xs text-warm-600">
        {tr("كل طلب كيتحسب فالشهر اللي جاوبتي عليه فيه، حتى إلا توصل من بعد.", "Each order counts in the month you answered it, even if it is delivered later.")}
      </p>

      <Panel title={tr("الطلبات اللي جاوبتي عليها", "Orders you answered")} className="mt-6">
        {rows.length ? (
          <div className="-mx-4 overflow-x-auto md:-mx-5">
            <table className="w-full min-w-[40rem]">
              <thead className="border-b border-warm-200/60">
                <tr>
                  <th className={thClass}>{tr("الطلب", "Order")}</th>
                  <th className={thClass}>{tr("الزبون", "Customer")}</th>
                  <th className={thClass}>{tr("الجواب ديالك", "Your answer")}</th>
                  <th className={thClass}>{tr("الحالة دابا", "Status now")}</th>
                  <th className={thClass}>{tr("ربحتي", "Earned")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const earned = o.handledAs === "CONFIRMED" ? user.payPerConfirmed + (o.status === "DELIVERED" ? user.payPerDelivered : 0) : 0;
                  return (
                    <tr key={o.id} className="border-b border-warm-200/60 last:border-0">
                      <td className={tdClass}>
                        <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold text-ink underline-offset-4 hover:underline" dir="ltr">
                          {o.number}
                        </Link>
                        <span className="block text-xs text-warm-600">{o.handledAt ? dateFmt.format(o.handledAt) : null}</span>
                      </td>
                      <td className={tdClass}>
                        <span className="block font-medium text-ink">{o.customerName}</span>
                        <span className="text-xs text-warm-600">{o.cityName} · {mad(o.total)}</span>
                      </td>
                      <td className={tdClass}>{o.handledAs ? <StatusBadge status={o.handledAs} lang={lang} /> : null}</td>
                      <td className={tdClass}>
                        <StatusBadge status={o.status} lang={lang} />
                      </td>
                      <td className={`${tdClass} font-bold text-ink`}>{earned ? mad(earned) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-warm-600">{tr("مازال ما جاوبتي على حتى طلب فهاد الشهر.", "You have not answered any order this month yet.")}</p>
        )}
      </Panel>
    </>
  );
}
