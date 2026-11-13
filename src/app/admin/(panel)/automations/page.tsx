import { Power, Trash2 } from "lucide-react";
import { addRule, deleteRule, toggleRule } from "@/app/actions/admin-automations";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { isParam, isTrigger, PARAMS, PARAMS_EN, TRIGGERS, TRIGGERS_EN } from "@/lib/automation-rules";
import { adminTr, type Tr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/time";

const JOB: Record<string, { label: [ar: string, en: string]; tone: BadgeTone }> = {
  PENDING: { label: ["فالانتظار", "Waiting"], tone: "neutral" },
  SENDING: { label: ["كيتصيفط", "Sending"], tone: "neutral" },
  SENT: { label: ["تصيفط", "Sent"], tone: "success" },
  SKIPPED: { label: ["تلغى", "Skipped"], tone: "warning" },
  FAILED: { label: ["فشل", "Failed"], tone: "danger" },
};

function delayText(minutes: number, tr: Tr) {
  if (!minutes) return tr("مباشرة", "Right away");
  if (minutes % 1440 === 0) return tr(`بعد ${minutes / 1440} يوم`, `After ${minutes / 1440} days`);
  if (minutes % 60 === 0) return tr(`بعد ${minutes / 60} ساعة`, `After ${minutes / 60} hours`);
  return tr(`بعد ${minutes} دقيقة`, `After ${minutes} minutes`);
}

export default async function AutomationsPage() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const dateFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
  const triggers: Record<string, string> = lang === "en" ? TRIGGERS_EN : TRIGGERS;
  const params: Record<string, string> = lang === "en" ? PARAMS_EN : PARAMS;
  const [rules, jobs] = await Promise.all([
    db.automationRule.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { jobs: true } } } }),
    db.automationJob.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { rule: { select: { name: true } } } }),
  ]);
  const orderNumbers = new Map((await db.order.findMany({ where: { id: { in: jobs.map((j) => j.orderId) } }, select: { id: true, number: true } })).map((o) => [o.id, o.number]));

  return (
    <>
      <PageHeader title={tr("الأتمتة", "Automations")} description={tr("رسائل واتساب كتمشي بوحدها ملي كتبدل حالة الطلب.", "WhatsApp messages that go out on their own when an order's status changes.")} />

      {/* "WhatsApp not connected" is in the notifications (the bell). */}
      <Panel title={tr("القواعد", "Rules")}>
        {rules.length ? (
          <ul className="flex flex-col divide-y divide-warm-200/60">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {r.name}
                    <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? tr("خدامة", "On") : tr("متوقفة", "Off")}</Badge>
                  </p>
                  <p className="mt-1 text-sm text-warm-600">
                    {isTrigger(r.trigger) ? triggers[r.trigger] : r.trigger} · {delayText(r.delayMinutes, tr)} · {tr("القالب", "Template")} <span dir="ltr">{r.templateName}</span> ({r.languageCode})
                  </p>
                  <p className="text-xs text-warm-500">
                    {r.params.length ? r.params.map((p, i) => `{{${i + 1}}} ${isParam(p) ? params[p] : p}`).join(" · ") : tr("بلا قيم", "No values")} · {tr(`${r._count.jobs} رسالة`, `${r._count.jobs} messages`)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <form action={toggleRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={buttonClass({ variant: r.isActive ? "outline" : "primary", className: "min-h-10 px-3 text-sm" })}>
                      <Power className="size-4" aria-hidden="true" />
                      {r.isActive ? tr("إيقاف", "Turn off") : tr("تشغيل", "Turn on")}
                    </button>
                  </form>
                  <form action={deleteRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" aria-label={tr(`حذف ${r.name}`, `Delete ${r.name}`)} className={buttonClass({ variant: "ghost", size: "icon" })}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-warm-600">{tr("مازال ما كاين حتى قاعدة.", "No rules yet.")}</p>
        )}
      </Panel>

      <Panel title={tr("قاعدة جديدة", "New rule")} className="mt-6">
        <p className="mb-3 text-sm text-warm-600">{tr("خارج 24 ساعة من آخر رسالة ديال الزبون، Meta كتقبل غير القوالب المعتمدة. أنشئ القالب فـ WhatsApp Manager، ومن بعد اكتب سميتو هنا بالضبط.", "Past 24 hours from the customer's last message, Meta only accepts approved templates. Create the template in WhatsApp Manager, then type its exact name here.")}</p>
        <ActionForm action={addRule} submitLabel={tr("إضافة القاعدة", "Add rule")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <L label={tr("سمية القاعدة", "Rule name")}>
            <input name="name" required maxLength={80} placeholder={tr("مثال: تذكير بالتأكيد", "e.g. Confirmation reminder")} className={inputClass} />
          </L>
          <L label={tr("متى؟", "When?")}>
            <select name="trigger" className={inputClass}>
              {Object.entries(triggers).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </L>
          <L label={tr("التأخير بالدقائق (0 = مباشرة)", "Delay in minutes (0 = right away)")}>
            <input name="delayMinutes" type="number" min={0} max={43200} defaultValue={0} required className={inputClass} />
          </L>
          <L label={tr("اسم القالب فـ Meta", "Template name in Meta")}>
            <input name="templateName" required dir="ltr" placeholder="order_confirmed" className={`${inputClass} text-start`} />
          </L>
          <L label={tr("لغة القالب", "Template language")}>
            <input name="languageCode" required dir="ltr" defaultValue="ar" className={`${inputClass} text-start`} />
          </L>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <L key={n} label={`{{${n}}}`}>
                <select name="param" defaultValue="" className={inputClass}>
                  <option value="">—</option>
                  {Object.entries(params).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </L>
            ))}
          </div>
        </ActionForm>
        <p className="mt-3 text-xs text-warm-600">{tr("كل قاعدة كتصيفط مرة وحدة لكل طلب. وإلا تبدلات حالة الطلب قبل ما يسالي التأخير، الرسالة كتلغى: الزبون اللي أكّد ما كيوصلوش تذكير بالتأكيد.", "Each rule sends once per order. If the order's status changes before the delay ends, the message is dropped: a customer who confirmed gets no confirmation reminder.")}</p>
      </Panel>

      <Panel title={tr("آخر الرسائل التلقائية", "Latest automatic messages")} className="mt-6">
        {jobs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem]">
              <thead>
                <tr>
                  <th className={thClass}>{tr("القاعدة", "Rule")}</th>
                  <th className={thClass}>{tr("الطلب", "Order")}</th>
                  <th className={thClass}>{tr("الموعد", "When")}</th>
                  <th className={thClass}>{tr("الحالة", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-warm-200/60">
                    <td className={tdClass}>{j.rule.name}</td>
                    <td className={`${tdClass} font-mono`} dir="ltr">
                      {orderNumbers.get(j.orderId) ?? "—"}
                    </td>
                    <td className={tdClass}>{dateFmt.format(j.sentAt ?? j.dueAt)}</td>
                    <td className={tdClass}>
                      <Badge tone={JOB[j.status].tone}>{tr(...JOB[j.status].label)}</Badge>
                      {j.error ? <span className="ms-2 text-xs text-warm-600">{j.error}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-warm-600">{tr("مازال ما تصيفطات حتى رسالة تلقائية.", "No automatic message sent yet.")}</p>
        )}
      </Panel>
    </>
  );
}
