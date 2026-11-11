import { cancelAssistantAction, confirmAssistantAction, undoAssistantAction } from "@/app/actions/admin-assistant";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/time";


const STATUS: Record<string, { label: [ar: string, en: string]; tone: BadgeTone }> = {
  PENDING: { label: ["كيتسنى التأكيد", "Awaiting confirmation"], tone: "accent" },
  APPLIED: { label: ["تنفذ", "Applied"], tone: "success" },
  CANCELLED: { label: ["تلغى", "Cancelled"], tone: "neutral" },
  EXPIRED: { label: ["سالا وقتو", "Expired"], tone: "neutral" },
  UNDONE: { label: ["تراجعتي عليه", "Undone"], tone: "warning" },
};

export default async function AssistantLogPage() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const when = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const rows = await db.assistantAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, status: true, summary: true, payload: true, model: true, requestedBy: true, decidedBy: true, undoneBy: true, createdAt: true, decidedAt: true },
  });

  return (
    <>
      <PageHeader
        title={tr("سجل المساعد الذكي", "Assistant log")}
        description={tr("كل ما اقترحه المساعد وما تنفذ منه. التراجع كيرجع الكمية ويتسجل فسجل حركات المخزون.", "Everything the assistant proposed and what was applied. Undo restores the quantity and is logged in the stock history.")}
      />
      <Panel>
        {rows.length ? (
          <div className="-mx-4 overflow-x-auto md:-mx-5">
            <table className="w-full min-w-[46rem]">
              <thead className="border-b border-white/70 bg-white/45">
                <tr>
                  {[tr("التاريخ", "Date"), tr("العملية", "Action"), tr("الحالة", "Status"), tr("بواسطة", "By"), ""].map((h) => (
                    <th key={h} className={thClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-warm-200/60 last:border-0">
                    <td className={`${tdClass} whitespace-nowrap`}>{when.format(a.decidedAt ?? a.createdAt)}</td>
                    <td className={tdClass}>
                      {a.summary}
                      {a.status === "PENDING" && (a.payload as { card?: { warning?: string } }).card?.warning ? (
                        <span className="block text-xs font-semibold text-warning-text">{(a.payload as { card: { warning: string } }).card.warning}</span>
                      ) : null}
                      <span className="block text-xs text-warm-500" dir="ltr">
                        {a.model}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <Badge tone={STATUS[a.status].tone}>{tr(...STATUS[a.status].label)}</Badge>
                    </td>
                    <td className={`${tdClass} max-w-44 truncate text-xs text-warm-600`} dir="ltr" title={a.undoneBy ?? a.decidedBy ?? a.requestedBy}>
                      {a.undoneBy ?? a.decidedBy ?? a.requestedBy}
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap items-start gap-2">
                        {a.status === "PENDING" ? (
                          <>
                            <ActionForm action={confirmAssistantAction} submitLabel={tr("تأكيد", "Confirm")} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="id" value={a.id} />
                            </ActionForm>
                            <ActionForm action={cancelAssistantAction} submitLabel={tr("إلغاء", "Cancel")} variant="outline" className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="id" value={a.id} />
                            </ActionForm>
                          </>
                        ) : null}
                        {a.status === "APPLIED" ? (
                          <ActionForm action={undoAssistantAction} submitLabel={tr("تراجع", "Undo")} variant="outline" confirm={tr("متأكد بغيتي تتراجع على هاد العملية؟", "Are you sure you want to undo this action?")} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="id" value={a.id} />
                          </ActionForm>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-warm-600">{tr("مازال ما كاين والو. حل المساعد من الزر الأصفر وجرب.", "Nothing yet. Open the assistant from the yellow button and try it.")}</p>
        )}
      </Panel>
    </>
  );
}
