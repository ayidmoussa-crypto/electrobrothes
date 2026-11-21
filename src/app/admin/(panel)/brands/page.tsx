import { deleteBrand, saveBrand } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { adminTr } from "@/lib/admin-lang";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("الماركات", "Brands");

export default async function BrandsPage() {
  const [, { tr }] = await Promise.all([requireAdmin(), adminTr()]);
  const brands = await db.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });

  return (
    <>
      <PageHeader title={tr("الماركات", "Brands")} />
      <Panel title={tr("ماركة جديدة", "New brand")} className="mb-4">
        <ActionForm action={saveBrand} submitLabel={tr("إضافة", "Add")} className="flex flex-wrap items-end gap-3">
          <L label={tr("الاسم", "Name")}>
            <input name="name" required dir="ltr" className={inputClass} />
          </L>
          <L label={tr("الرابط (slug)", "Link (slug)")}>
            <input name="slug" dir="ltr" placeholder={tr("تلقائي", "Automatic")} className={inputClass} />
          </L>
        </ActionForm>
      </Panel>
      <ul className="grid gap-3 md:grid-cols-2">
        {brands.map((b) => (
          <li key={b.id} className="admin-card p-4">
            <ActionForm action={saveBrand} submitLabel={tr("حفظ", "Save")} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={b.id} />
              <L label={tr(`الاسم · ${b._count.products} منتج`, `Name · ${b._count.products} products`)}>
                <input name="name" defaultValue={b.name} required dir="ltr" className={inputClass} />
              </L>
              <L label={tr("الرابط", "Link")}>
                <input name="slug" defaultValue={b.slug} dir="ltr" className={inputClass} />
              </L>
            </ActionForm>
            {b._count.products === 0 ? (
              <ActionForm action={deleteBrand} submitLabel={tr("حذف", "Delete")} variant="ghost" className="mt-2" confirm={tr("حذف هذه الماركة؟", "Delete this brand?")}>
                <input type="hidden" name="id" value={b.id} />
              </ActionForm>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
