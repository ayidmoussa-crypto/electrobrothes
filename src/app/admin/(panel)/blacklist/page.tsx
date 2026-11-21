import { Trash2 } from "lucide-react";
import { addToBlacklist, removeFromBlacklist } from "@/app/actions/admin-orders";
import { ActionForm } from "@/components/admin/ActionForm";
import { Pagination, pageHref } from "@/components/admin/Pagination";
import { inputClass, L, PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { clampPage, parsePage } from "@/lib/pagination";
import { formatMoroccanPhone } from "@/lib/phone";
import { TIME_ZONE } from "@/lib/time";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("القائمة السوداء", "Blacklist");

const PAGE = 25;

export default async function BlacklistPage({ searchParams }: PageProps<"/admin/blacklist">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const dateFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeZone: TIME_ZONE });
  const total = await db.blacklist.count();
  const page = clampPage(parsePage((await searchParams).page), total, PAGE);
  const entries = await db.blacklist.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PAGE, take: PAGE });

  return (
    <>
      <PageHeader title={tr("القائمة السوداء", "Blacklist")} description={tr("الأرقام المحظورة لا يمكنها الطلب عبر الموقع (طلبات وهمية، رفض متكرر للاستلام…).", "Blocked numbers cannot order on the site (fake orders, repeated refusals…).")} />
      <Panel title={tr("حظر رقم", "Block a number")} className="mb-4">
        <ActionForm action={addToBlacklist} submitLabel={tr("حظر", "Block")} className="flex flex-wrap items-end gap-3">
          <L label={tr("رقم الهاتف", "Phone number")}>
            <input name="phone" type="tel" required dir="ltr" placeholder="06 12 34 56 78" className={inputClass} />
          </L>
          <L label={tr("السبب", "Reason")} className="min-w-64 flex-1">
            <input name="reason" maxLength={200} className={inputClass} />
          </L>
        </ActionForm>
      </Panel>
      <div className="overflow-x-auto admin-card">
        <table className="w-full">
          <thead className="border-b border-white/70 bg-white/45">
            <tr>
              <th className={thClass}>{tr("الرقم", "Number")}</th>
              <th className={thClass}>{tr("السبب", "Reason")}</th>
              <th className={thClass}>{tr("التاريخ", "Date")}</th>
              <th className={thClass}>
                <span className="sr-only">{tr("إجراء", "Action")}</span>
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
                    <button type="submit" className="grid size-10 cursor-pointer place-items-center rounded-lg text-warm-600 hover:bg-white/70 hover:text-danger" aria-label={tr(`إزالة ${formatMoroccanPhone(e.phone)} من القائمة`, `Remove ${formatMoroccanPhone(e.phone)} from the list`)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!entries.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-warm-600">
                  {tr("القائمة فارغة.", "The list is empty.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} size={PAGE} href={(n) => pageHref("/admin/blacklist", {}, n)} tr={tr} />
    </>
  );
}
