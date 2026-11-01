import { cancelAssistantAction, confirmAssistantAction, undoAssistantAction } from "@/app/actions/admin-assistant";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const when = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" });

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "كيتسنى التأكيد", tone: "accent" },
  APPLIED: { label: "تنفذ", tone: "success" },
  CANCELLED: { label: "تلغى", tone: "neutral" },
  EXPIRED: { label: "سالا وقتو", tone: "neutral" },
  UNDONE: { label: "تراجعتي عليه", tone: "warning" },
};

export default async function AssistantLogPage() {
  await requireAdmin();
  const rows = await db.assistantAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, status: true, summary: true, payload: true, model: true, requestedBy: true, decidedBy: true, undoneBy: true, createdAt: true, decidedAt: true },
  });

  return (
    <>
      <PageHeader title="سجل المساعد الذكي" description="كل ما اقترحه المساعد وما تنفذ منه. التراجع كيرجع الكمية ويتسجل فسجل حركات المخزون." />
      <Panel>
        {rows.length ? (
          <div className="-mx-4 overflow-x-auto md:-mx-5">
            <table className="w-full min-w-[46rem]">
              <thead className="border-b border-white/70 bg-white/45">
                <tr>
                  {["التاريخ", "العملية", "الحالة", "بواسطة", ""].map((h) => (
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
                      <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                    </td>
                    <td className={`${tdClass} max-w-44 truncate text-xs text-warm-600`} dir="ltr" title={a.undoneBy ?? a.decidedBy ?? a.requestedBy}>
                      {a.undoneBy ?? a.decidedBy ?? a.requestedBy}
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap items-start gap-2">
                        {a.status === "PENDING" ? (
                          <>
                            <ActionForm action={confirmAssistantAction} submitLabel="تأكيد" className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="id" value={a.id} />
                            </ActionForm>
                            <ActionForm action={cancelAssistantAction} submitLabel="إلغاء" variant="outline" className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="id" value={a.id} />
                            </ActionForm>
                          </>
                        ) : null}
                        {a.status === "APPLIED" ? (
                          <ActionForm action={undoAssistantAction} submitLabel="تراجع" variant="outline" confirm="متأكد بغيتي تتراجع على هاد العملية؟" className="flex flex-wrap items-center gap-2">
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
          <p className="text-sm text-warm-600">مازال ما كاين والو. حل المساعد من الزر الأصفر وجرب.</p>
        )}
      </Panel>
    </>
  );
}
