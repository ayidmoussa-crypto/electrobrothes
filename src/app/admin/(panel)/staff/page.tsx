import { ChevronDown, UserPlus } from "lucide-react";
import { cancelAgentPayment, createAgent, payAgent, updateAgent } from "@/app/actions/admin-staff";
import { ActionForm } from "@/components/admin/ActionForm";
import { MonthPills, monthTitle } from "@/components/admin/MonthPills";
import { inputClass, L, PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { formatMAD } from "@/lib/money";
import { loadBalances, recentPayments, teamMonth } from "@/lib/staff";
import { agentStats, monthRange } from "@/lib/staff-rules";
import { TIME_ZONE } from "@/lib/time";

/** The owner's view of the confirmation team: each agent's month, their pay, and their accounts. */
export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const q = await searchParams;
  const { start, end, key } = monthRange(typeof q.month === "string" ? q.month : undefined);
  const [month, balanceOf, payments] = await Promise.all([teamMonth(start, end), loadBalances(), recentPayments()]);
  const team = month.map((a) => ({ ...a, s: agentStats(a.rows, a), balance: balanceOf(a), payments: payments.filter((p) => p.agentId === a.id).slice(0, 5) }));
  const mad = (v: number) => formatMAD(v, lang);
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
  const seen = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
  const totalDue = team.reduce((sum, a) => sum + Math.max(0, a.balance.amount), 0);

  return (
    <>
      <PageHeader
        title={tr("فريق التأكيد", "Confirmation team")}
        description={tr(`المجموع للخلاص دابا: ${mad(totalDue)}`, `Total to pay now: ${mad(totalDue)}`)}
      />

      {team.length ? (
        <Panel title={tr("الخلاص", "Payments")} className="mb-6">
          <ul className="grid gap-3 lg:grid-cols-2">
            {team.map((a) => (
              <li key={a.id} className="min-w-0 rounded-2xl admin-field p-4">
                <p className="font-semibold text-ink">{a.name}</p>
                <p className="mt-2 text-xs font-semibold text-warm-600">{tr("اللي خاصو يتخلص دابا", "To pay now")}</p>
                <p className="text-3xl font-extrabold text-ink">{mad(Math.max(0, a.balance.amount))}</p>
                <p className="mt-1 text-xs text-warm-600">
                  {a.balance.amount < 0
                    ? tr(`تخلص زيادة بـ ${mad(-a.balance.amount)}، غادي تنقص من الخلصة الجاية.`, `Overpaid by ${mad(-a.balance.amount)}; it comes off the next payment.`)
                    : tr(`${a.balance.confirmed} تأكيد · ${a.balance.delivered} توصيل مازال ما تخلصو`, `${a.balance.confirmed} confirmed · ${a.balance.delivered} delivered, still unpaid`)}
                </p>
                {a.balance.amount > 0 ? (
                  <ActionForm
                    key={a.balance.amount}
                    action={payAgent}
                    submitLabel={tr(`خلصت ${mad(a.balance.amount)}`, `I paid ${mad(a.balance.amount)}`)}
                    confirm={tr(`واش خلصتي ${a.name} ${mad(a.balance.amount)}؟ الرصيد غادي يرجع لصفر والمبلغ ينقص من أرباح هاد الشهر.`, `Did you pay ${a.name} ${mad(a.balance.amount)}? The balance goes back to zero and the amount comes off this month's profit.`)}
                    className="mt-3 flex flex-col gap-3"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="amount" value={a.balance.amount} />
                  </ActionForm>
                ) : null}
                {a.payments.length ? (
                  <details className="group mt-3 border-t border-warm-200/60 pt-1">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-warm-800">
                      {tr("آخر الخلصات", "Latest payments")}
                      <ChevronDown className="size-4 shrink-0 text-warm-600 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <ul>
                      {a.payments.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-warm-200/60 py-2">
                          <span className="text-sm">
                            <span className="font-bold text-ink">{mad(p.amount)}</span>
                            <span className="block text-xs text-warm-600">{seen.format(p.paidAt)}</span>
                          </span>
                          <ActionForm
                            action={cancelAgentPayment}
                            submitLabel={tr("إلغاء", "Cancel")}
                            variant="outline"
                            confirm={tr(`نلغيو خلصة ${mad(p.amount)}؟ المبلغ يرجع للرصيد وللأرباح.`, `Cancel the ${mad(p.amount)} payment? The amount returns to the balance and the profit.`)}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="id" value={p.id} />
                          </ActionForm>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-warm-600">
            {tr("ملي تخلص، سجلها هنا: الرصيد كيرجع لصفر، والمبلغ كيتزاد فالمصاريف تحت «أجور» وكينقص من أرباح الشهر اللي خلصتي فيه.", "Once you have paid, record it here: the balance returns to zero and the amount is added to expenses as salaries, reducing the profit of the month you paid in.")}
          </p>
        </Panel>
      ) : null}

      <div className="mb-3 flex justify-end">
        <MonthPills basePath="/admin/staff" current={key} lang={lang} />
      </div>
      <Panel title={tr(`الأداء ديال كل موظف · ${monthTitle(key, lang)}`, `Each agent's month · ${monthTitle(key, lang)}`)}>
        {team.length ? (
          <div className="-mx-4 overflow-x-auto md:-mx-5">
            <table className="w-full min-w-[48rem]">
              <thead className="border-b border-warm-200/60">
                <tr>
                  <th className={thClass}>{tr("الموظف", "Agent")}</th>
                  <th className={thClass}>{tr("جاوب على", "Answered")}</th>
                  <th className={thClass}>{tr("أكّد", "Confirmed")}</th>
                  <th className={thClass}>{tr("نسبة التأكيد", "Confirmation")}</th>
                  <th className={thClass}>{tr("توصلو", "Delivered")}</th>
                  <th className={thClass}>{tr("نسبة التوصيل", "Delivery")}</th>
                  <th className={thClass}>{tr("ربح الشهر", "Month's earnings")}</th>
                </tr>
              </thead>
              <tbody>
                {team.map((a) => (
                  <tr key={a.id} className="border-b border-warm-200/60 last:border-0">
                    <td className={tdClass}>
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        {a.name}
                        {a.isActive ? null : <Badge tone="neutral">{tr("موقوف", "Off")}</Badge>}
                      </span>
                      <span className="block text-xs text-warm-600" dir="ltr">
                        {a.email}
                      </span>
                    </td>
                    <td className={tdClass}>{a.s.handled}</td>
                    <td className={tdClass}>{a.s.confirmed}</td>
                    <td className={`${tdClass} font-bold text-ink`}>{pct(a.s.confirmation)}</td>
                    <td className={tdClass}>
                      {a.s.delivered}
                      {a.s.onTheWay ? <span className="block text-xs text-warm-600">{tr(`${a.s.onTheWay} فالطريق`, `${a.s.onTheWay} on the way`)}</span> : null}
                    </td>
                    <td className={`${tdClass} font-bold text-ink`}>{pct(a.s.delivery)}</td>
                    <td className={`${tdClass} font-extrabold text-ink`}>{mad(a.s.earnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-warm-600">{tr("مازال ما زدتي حتى موظف. زيدو من التحت.", "No agents yet. Add one below.")}</p>
        )}
        <p className="mt-3 text-xs text-warm-600">
          {tr(
            "ربح الشهر = عدد الطلبات اللي أكّد × ثمن التأكيد + اللي توصلو منهم × ثمن التوصيل. كل طلب كيتحسب فالشهر اللي تجاوب عليه فيه، وهاد الرقم كيبقى كسجل حتى من بعد الخلاص.",
            "Month's earnings = orders confirmed × pay per confirmation + those delivered × pay per delivery. Each order counts in the month it was answered, and this figure stays as a record after payment.",
          )}
        </p>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={tr("زيد موظف", "Add an agent")}>
          <ActionForm action={createAgent} submitLabel={tr("زيد الموظف", "Add agent")} className="grid gap-3 sm:grid-cols-2">
            <L label={tr("الاسم", "Name")}>
              <input name="name" required minLength={2} maxLength={80} className={inputClass} />
            </L>
            <L label={tr("الإيميل (للدخول)", "Email (to sign in)")}>
              <input name="email" type="email" required maxLength={120} dir="ltr" autoComplete="off" className={`${inputClass} text-start`} />
            </L>
            <L label={tr("كلمة السر (10 حروف على الأقل)", "Password (at least 10 characters)")} className="sm:col-span-2">
              <input name="password" type="text" required minLength={10} maxLength={200} dir="ltr" autoComplete="new-password" className={`${inputClass} text-start`} />
            </L>
            <L label={tr("الخلصة على كل طلب أكّدو (درهم)", "Pay per confirmed order (MAD)")}>
              <input name="payPerConfirmed" type="number" min={0} max={10000} defaultValue={0} className={inputClass} />
            </L>
            <L label={tr("الخلصة على كل طلب توصل (درهم)", "Pay per delivered order (MAD)")}>
              <input name="payPerDelivered" type="number" min={0} max={10000} defaultValue={0} className={inputClass} />
            </L>
          </ActionForm>
          <p className="mt-3 flex items-start gap-2 text-xs text-warm-600">
            <UserPlus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {tr(
              "الموظف كيدخل من نفس صفحة الدخول ديال اللوحة، وكيشوف غير الطلبات والأرقام ديالو. كيقدر يزيد طلبات جات فواتساب ولا بالتيليفون، ويأكد ولا يلغي غير الطلبات الجديدة.",
              "The agent signs in on the same panel login page and only sees orders and their own figures. They can add orders that came by WhatsApp or phone, and only confirm or cancel new orders.",
            )}
          </p>
        </Panel>

        {team.length ? (
          <Panel title={tr("الحسابات", "Accounts")}>
            <ul className="flex flex-col gap-2">
              {team.map((a) => (
                <li key={a.id}>
                  <details className="group rounded-xl admin-field">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
                      <span>
                        <span className="font-semibold text-ink">{a.name}</span>
                        <span className="block text-xs text-warm-600">
                          {a.lastLoginAt ? tr(`آخر دخول ${seen.format(a.lastLoginAt)}`, `Last sign-in ${seen.format(a.lastLoginAt)}`) : tr("مازال ما دخلش", "Never signed in")}
                        </span>
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-warm-600 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <ActionForm action={updateAgent} submitLabel={tr("حفظ", "Save")} variant="dark" className="grid gap-3 border-t border-warm-200/60 p-3 sm:grid-cols-2">
                      <input type="hidden" name="id" value={a.id} />
                      <L label={tr("الاسم", "Name")}>
                        <input name="name" required minLength={2} maxLength={80} defaultValue={a.name} className={inputClass} />
                      </L>
                      <L label={tr("الحساب", "Account")}>
                        <select name="active" defaultValue={a.isActive ? "1" : "0"} className={inputClass}>
                          <option value="1">{tr("خدام", "Active")}</option>
                          <option value="0">{tr("موقوف (ما يقدرش يدخل)", "Off (cannot sign in)")}</option>
                        </select>
                      </L>
                      <L label={tr("على كل تأكيد (درهم)", "Per confirmation (MAD)")}>
                        <input name="payPerConfirmed" type="number" min={0} max={10000} defaultValue={a.payPerConfirmed} className={inputClass} />
                      </L>
                      <L label={tr("على كل توصيل (درهم)", "Per delivery (MAD)")}>
                        <input name="payPerDelivered" type="number" min={0} max={10000} defaultValue={a.payPerDelivered} className={inputClass} />
                      </L>
                      <L label={tr("كلمة سر جديدة (خليها خاوية باش تبقى القديمة)", "New password (leave empty to keep the current one)")} className="sm:col-span-2">
                        <input name="password" type="text" minLength={10} maxLength={200} dir="ltr" autoComplete="new-password" className={`${inputClass} text-start`} />
                      </L>
                    </ActionForm>
                  </details>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-warm-600">{tr("تبديل الثمن كيبدل أرقام الأداء ديال الشهور كاملة، ولكن فالخلاص كيمس غير الطلبات اللي مازال ما تخلصو.", "Changing the rate recalculates the monthly figures, but for payments it only affects orders not yet paid.")}</p>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
