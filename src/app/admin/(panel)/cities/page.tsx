import Link from "next/link";
import { saveCity } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

type City = { id?: string; nameAr: string; nameEn: string; shippingFee: number; deliveryDays: string; isActive: boolean; sortOrder: number };

function CityFields({ c }: { c: City }) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-6">
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <L label="بالعربية">
        <input name="nameAr" defaultValue={c.nameAr} required className={inputClass} />
      </L>
      <L label="بالإنجليزية">
        <input name="nameEn" defaultValue={c.nameEn} required dir="ltr" className={inputClass} />
      </L>
      <L label="رسوم التوصيل (درهم)">
        <input name="shippingFee" type="number" min={0} defaultValue={c.shippingFee} required className={inputClass} />
      </L>
      <L label="مدة التوصيل (أيام)">
        <input name="deliveryDays" defaultValue={c.deliveryDays} required dir="ltr" placeholder="2-4" className={inputClass} />
      </L>
      <L label="الترتيب">
        <input name="sortOrder" type="number" min={0} defaultValue={c.sortOrder} className={inputClass} />
      </L>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm text-warm-800">
        <input type="checkbox" name="isActive" defaultChecked={c.isActive} className="size-5 accent-ink" />
        مفعّلة
      </label>
    </div>
  );
}

export default async function CitiesPage() {
  await requireAdmin();
  const [cities, settings] = await Promise.all([db.city.findMany({ orderBy: { sortOrder: "asc" } }), db.settings.findUnique({ where: { id: 1 } })]);

  return (
    <>
      <PageHeader
        title="المدن ورسوم التوصيل"
        description={`التوصيل مجاني ابتداءً من ${settings?.freeShippingThreshold ?? 1000} درهم.`}
        actions={
          <Link href="/admin/settings" className="text-sm font-semibold text-ink underline underline-offset-4">
            تعديل حد التوصيل المجاني
          </Link>
        }
      />
      <Panel title="مدينة جديدة" className="mb-4">
        <ActionForm action={saveCity} submitLabel="إضافة">
          <CityFields c={{ nameAr: "", nameEn: "", shippingFee: 30, deliveryDays: "1-3", isActive: true, sortOrder: cities.length }} />
        </ActionForm>
      </Panel>
      <ul className="flex flex-col gap-2">
        {cities.map((c) => (
          <li key={c.id} className="rounded-xl border border-warm-200 bg-white p-3">
            <ActionForm action={saveCity} submitLabel="حفظ" variant="outline" className="flex flex-wrap items-end gap-3">
              <CityFields c={c} />
            </ActionForm>
          </li>
        ))}
      </ul>
    </>
  );
}
