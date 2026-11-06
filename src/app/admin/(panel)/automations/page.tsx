import { Power, Trash2, Unplug } from "lucide-react";
import { addRule, deleteRule, toggleRule } from "@/app/actions/admin-automations";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { isParam, isTrigger, PARAMS, TRIGGERS } from "@/lib/automation-rules";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/time";
import { waConfig } from "@/lib/whatsapp/client";

const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
const JOB: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "فالانتظار", tone: "neutral" },
  SENDING: { label: "كيتصيفط", tone: "neutral" },
  SENT: { label: "تصيفط", tone: "success" },
  SKIPPED: { label: "تلغى", tone: "warning" },
  FAILED: { label: "فشل", tone: "danger" },
};

function delayText(minutes: number) {
  if (!minutes) return "مباشرة";
  if (minutes % 1440 === 0) return `بعد ${minutes / 1440} يوم`;
  if (minutes % 60 === 0) return `بعد ${minutes / 60} ساعة`;
  return `بعد ${minutes} دقيقة`;
}

export default async function AutomationsPage() {
  await requireAdmin();
  const [rules, jobs] = await Promise.all([
    db.automationRule.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { jobs: true } } } }),
    db.automationJob.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { rule: { select: { name: true } } } }),
  ]);
  const orderNumbers = new Map((await db.order.findMany({ where: { id: { in: jobs.map((j) => j.orderId) } }, select: { id: true, number: true } })).map((o) => [o.id, o.number]));

  return (
    <>
      <PageHeader title="الأتمتة" description="رسائل واتساب كتمشي بوحدها ملي كتبدل حالة الطلب." />

      {!waConfig() ? (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border border-warning/40 bg-warning-soft/85 p-4 text-sm font-semibold text-warning-text">
          <Unplug className="size-5 shrink-0" aria-hidden="true" />
          واتساب مازال ما مربوطش: الرسائل كتبقى فالانتظار وما كيتصيفط والو حتى يتربط.
        </p>
      ) : null}

      <Panel title="القواعد">
        {rules.length ? (
          <ul className="flex flex-col divide-y divide-warm-200/60">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {r.name}
                    <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "خدامة" : "متوقفة"}</Badge>
                  </p>
                  <p className="mt-1 text-sm text-warm-600">
                    {isTrigger(r.trigger) ? TRIGGERS[r.trigger] : r.trigger} · {delayText(r.delayMinutes)} · القالب <span dir="ltr">{r.templateName}</span> ({r.languageCode})
                  </p>
                  <p className="text-xs text-warm-500">
                    {r.params.length ? r.params.map((p, i) => `{{${i + 1}}} ${isParam(p) ? PARAMS[p] : p}`).join(" · ") : "بلا قيم"} · {r._count.jobs} رسالة
                  </p>
                </div>
                <div className="flex gap-1">
                  <form action={toggleRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={buttonClass({ variant: r.isActive ? "outline" : "primary", className: "min-h-10 px-3 text-sm" })}>
                      <Power className="size-4" aria-hidden="true" />
                      {r.isActive ? "إيقاف" : "تشغيل"}
                    </button>
                  </form>
                  <form action={deleteRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" aria-label={`حذف ${r.name}`} className={buttonClass({ variant: "ghost", size: "icon" })}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-warm-600">مازال ما كاين حتى قاعدة.</p>
        )}
      </Panel>

      <Panel title="قاعدة جديدة" className="mt-6">
        <p className="mb-3 text-sm text-warm-600">خارج 24 ساعة من آخر رسالة ديال الزبون، Meta كتقبل غير القوالب المعتمدة. أنشئ القالب فـ WhatsApp Manager، ومن بعد اكتب سميتو هنا بالضبط.</p>
        <ActionForm action={addRule} submitLabel="إضافة القاعدة" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <L label="سمية القاعدة">
            <input name="name" required maxLength={80} placeholder="مثال: تذكير بالتأكيد" className={inputClass} />
          </L>
          <L label="متى؟">
            <select name="trigger" className={inputClass}>
              {Object.entries(TRIGGERS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </L>
          <L label="التأخير بالدقائق (0 = مباشرة)">
            <input name="delayMinutes" type="number" min={0} max={43200} defaultValue={0} required className={inputClass} />
          </L>
          <L label="اسم القالب فـ Meta">
            <input name="templateName" required dir="ltr" placeholder="order_confirmed" className={`${inputClass} text-start`} />
          </L>
          <L label="لغة القالب">
            <input name="languageCode" required dir="ltr" defaultValue="ar" className={`${inputClass} text-start`} />
          </L>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <L key={n} label={`{{${n}}}`}>
                <select name="param" defaultValue="" className={inputClass}>
                  <option value="">—</option>
                  {Object.entries(PARAMS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </L>
            ))}
          </div>
        </ActionForm>
        <p className="mt-3 text-xs text-warm-600">كل قاعدة كتصيفط مرة وحدة لكل طلب. وإلا تبدلات حالة الطلب قبل ما يسالي التأخير، الرسالة كتلغى: الزبون اللي أكّد ما كيوصلوش تذكير بالتأكيد.</p>
      </Panel>

      <Panel title="آخر الرسائل التلقائية" className="mt-6">
        {jobs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem]">
              <thead>
                <tr>
                  <th className={thClass}>القاعدة</th>
                  <th className={thClass}>الطلب</th>
                  <th className={thClass}>الموعد</th>
                  <th className={thClass}>الحالة</th>
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
                      <Badge tone={JOB[j.status].tone}>{JOB[j.status].label}</Badge>
                      {j.error ? <span className="ms-2 text-xs text-warm-600">{j.error}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-warm-600">مازال ما تصيفطات حتى رسالة تلقائية.</p>
        )}
      </Panel>
    </>
  );
}
