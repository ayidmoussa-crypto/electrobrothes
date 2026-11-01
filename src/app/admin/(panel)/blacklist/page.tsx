import { Trash2 } from "lucide-react";
import { addToBlacklist, removeFromBlacklist } from "@/app/actions/admin-orders";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatMoroccanPhone } from "@/lib/phone";
import { TIME_ZONE } from "@/lib/time";

const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeZone: TIME_ZONE });

export default async function BlacklistPage() {
  await requireAdmin();
  const entries = await db.blacklist.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <PageHeader title="القائمة السوداء" description="الأرقام المحظورة لا يمكنها الطلب عبر الموقع (طلبات وهمية، رفض متكرر للاستلام…)." />
      <Panel title="حظر رقم" className="mb-4">
        <ActionForm action={addToBlacklist} submitLabel="حظر" className="flex flex-wrap items-end gap-3">
          <L label="رقم الهاتف">
            <input name="phone" type="tel" required dir="ltr" placeholder="06 12 34 56 78" className={inputClass} />
          </L>
          <L label="السبب" className="min-w-64 flex-1">
            <input name="reason" maxLength={200} className={inputClass} />
          </L>
        </ActionForm>
      </Panel>
      <div className="overflow-x-auto admin-card">
        <table className="w-full">
          <thead className="border-b border-white/70 bg-white/45">
            <tr>
              <th className={thClass}>الرقم</th>
              <th className={thClass}>السبب</th>
              <th className={thClass}>التاريخ</th>
              <th className={thClass}>
                <span className="sr-only">إجراء</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-warm-200/60 last:border-0">
                <td className={`${tdClass} font-semibold text-ink`} dir="ltr">
                  {formatMoroccanPhone(e.phone)}
                </td>
                <td className={tdClass}>{e.reason ?? "—"}</td>
                <td className={tdClass}>{dateFmt.format(e.createdAt)}</td>
                <td className={tdClass}>
                  <form action={removeFromBlacklist}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="grid size-10 cursor-pointer place-items-center rounded-lg text-warm-600 hover:bg-white/70 hover:text-danger" aria-label={`إزالة ${formatMoroccanPhone(e.phone)} من القائمة`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!entries.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-warm-600">
                  القائمة فارغة.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
