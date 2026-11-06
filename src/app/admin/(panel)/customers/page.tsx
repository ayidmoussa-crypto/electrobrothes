import { Trash2 } from "lucide-react";
import { removeSubscriber } from "@/app/actions/admin-customers";
import { PageHeader, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/time";

const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });

export default async function CustomersPage() {
  await requireAdmin();
  const emails = await db.emailSubscriber.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <PageHeader title="الزبناء" description={`عناوين البريد التي تركها الزوار في الصفحة الرئيسية: ${emails.length}.`} />
      <div className="overflow-x-auto admin-card">
        <table className="w-full">
          <thead className="border-b border-white/70 bg-white/45">
            <tr>
              <th className={thClass}>البريد الإلكتروني</th>
              <th className={thClass}>اللغة</th>
              <th className={thClass}>التاريخ</th>
              <th className={thClass}>
                <span className="sr-only">إجراء</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => (
              <tr key={e.id} className="border-b border-warm-200/60 last:border-0">
                <td className={`${tdClass} font-semibold text-ink`} dir="ltr">
                  <a href={`mailto:${e.email}`} className="underline-offset-4 hover:underline">
                    {e.email}
                  </a>
                </td>
                <td className={tdClass}>{e.locale === "en" ? "الإنجليزية" : "العربية"}</td>
                <td className={tdClass}>{dateFmt.format(e.createdAt)}</td>
                <td className={tdClass}>
                  <form action={removeSubscriber}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="grid size-10 cursor-pointer place-items-center rounded-lg text-warm-600 hover:bg-white/70 hover:text-danger" aria-label={`حذف ${e.email}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!emails.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-warm-600">
                  لا يوجد أي بريد بعد.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
