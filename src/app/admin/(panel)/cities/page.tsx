import Link from "next/link";
import { saveCity } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { adminTr, type Tr } from "@/lib/admin-lang";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

type City = { id?: string; nameAr: string; nameEn: string; shippingFee: number; deliveryDays: string; isActive: boolean; sortOrder: number };

function CityFields({ c, tr }: { c: City; tr: Tr }) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-6">
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <L label={tr("بالعربية", "In Arabic")}>
        <input name="nameAr" defaultValue={c.nameAr} required className={inputClass} />
      </L>
      <L label={tr("بالإنجليزية", "In English")}>
        <input name="nameEn" defaultValue={c.nameEn} required dir="ltr" className={inputClass} />
      </L>
      <L label={tr("رسوم التوصيل (درهم)", "Delivery fee (MAD)")}>
        <input name="shippingFee" type="number" min={0} defaultValue={c.shippingFee} required className={inputClass} />
      </L>
      <L label={tr("مدة التوصيل (أيام)", "Delivery time (days)")}>
        <input name="deliveryDays" defaultValue={c.deliveryDays} required dir="ltr" placeholder="2-4" className={inputClass} />
      </L>
      <L label={tr("الترتيب", "Order")}>
        <input name="sortOrder" type="number" min={0} defaultValue={c.sortOrder} className={inputClass} />
      </L>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm text-warm-800">
        <input type="checkbox" name="isActive" defaultChecked={c.isActive} className="size-5 accent-ink" />
        {tr("مفعّلة", "Active")}
      </label>
    </div>
  );
}

export default async function CitiesPage() {
  const [, { tr }] = await Promise.all([requireAdmin(), adminTr()]);
  const [cities, settings] = await Promise.all([db.city.findMany({ orderBy: { sortOrder: "asc" } }), db.settings.findUnique({ where: { id: 1 } })]);

  return (
    <>
      <PageHeader
        title={tr("المدن ورسوم التوصيل", "Cities & delivery fees")}
        description={tr(`التوصيل مجاني ابتداءً من ${settings?.freeShippingThreshold ?? 1000} درهم.`, `Free delivery from MAD ${settings?.freeShippingThreshold ?? 1000}.`)}
        actions={
          <Link href="/admin/settings" className="text-sm font-semibold text-ink underline underline-offset-4">
            {tr("تعديل حد التوصيل المجاني", "Change the free delivery threshold")}
          </Link>
        }
      />
      <Panel title={tr("مدينة جديدة", "New city")} className="mb-4">
        <ActionForm action={saveCity} submitLabel={tr("إضافة", "Add")}>
          <CityFields tr={tr} c={{ nameAr: "", nameEn: "", shippingFee: 30, deliveryDays: "1-3", isActive: true, sortOrder: cities.length }} />
        </ActionForm>
      </Panel>
      <ul className="flex flex-col gap-2">
        {cities.map((c) => (
          <li key={c.id} className="admin-row p-3">
            <ActionForm action={saveCity} submitLabel={tr("حفظ", "Save")} variant="outline" className="flex flex-wrap items-end gap-3">
              <CityFields tr={tr} c={c} />
            </ActionForm>
          </li>
        ))}
      </ul>
    </>
  );
}
