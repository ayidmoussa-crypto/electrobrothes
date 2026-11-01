import { deleteBrand, saveBrand } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function BrandsPage() {
  await requireAdmin();
  const brands = await db.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });

  return (
    <>
      <PageHeader title="الماركات" />
      <Panel title="ماركة جديدة" className="mb-4">
        <ActionForm action={saveBrand} submitLabel="إضافة" className="flex flex-wrap items-end gap-3">
          <L label="الاسم">
            <input name="name" required dir="ltr" className={inputClass} />
          </L>
          <L label="الرابط (slug)">
            <input name="slug" dir="ltr" placeholder="تلقائي" className={inputClass} />
          </L>
        </ActionForm>
      </Panel>
      <ul className="grid gap-3 md:grid-cols-2">
        {brands.map((b) => (
          <li key={b.id} className="admin-card p-4">
            <ActionForm action={saveBrand} submitLabel="حفظ" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={b.id} />
              <L label={`الاسم · ${b._count.products} منتج`}>
                <input name="name" defaultValue={b.name} required dir="ltr" className={inputClass} />
              </L>
              <L label="الرابط">
                <input name="slug" defaultValue={b.slug} dir="ltr" className={inputClass} />
              </L>
            </ActionForm>
            {b._count.products === 0 ? (
              <ActionForm action={deleteBrand} submitLabel="حذف" variant="ghost" className="mt-2" confirm="حذف هذه الماركة؟">
                <input type="hidden" name="id" value={b.id} />
              </ActionForm>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
