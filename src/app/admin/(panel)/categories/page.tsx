import { deleteCategory, saveCategory } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

type Cat = { id?: string; nameAr: string; nameEn: string; slug: string; image: string | null; sortOrder: number };

function CategoryFields({ c }: { c: Cat }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <L label="الاسم بالعربية">
        <input name="nameAr" defaultValue={c.nameAr} required className={inputClass} />
      </L>
      <L label="الاسم بالإنجليزية">
        <input name="nameEn" defaultValue={c.nameEn} required dir="ltr" className={inputClass} />
      </L>
      <L label="الرابط (slug)">
        <input name="slug" defaultValue={c.slug} dir="ltr" placeholder="تلقائي" className={inputClass} />
      </L>
      <L label="رابط الصورة">
        <input name="image" defaultValue={c.image ?? ""} dir="ltr" className={inputClass} />
      </L>
      <L label="الترتيب">
        <input name="sortOrder" type="number" min={0} defaultValue={c.sortOrder} className={inputClass} />
      </L>
    </div>
  );
}

export default async function CategoriesPage() {
  await requireAdmin();
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });

  return (
    <>
      <PageHeader title="الأقسام" description="تظهر في القائمة العلوية، الصفحة الرئيسية والفوتر." />
      <div className="flex flex-col gap-4">
        {categories.map((c) => (
          <Panel key={c.id} title={`${c.nameAr} · ${c._count.products} منتج`}>
            <ActionForm action={saveCategory} submitLabel="حفظ">
              <CategoryFields c={c} />
            </ActionForm>
            {c._count.products === 0 ? (
              <div className="mt-2">
                <ActionForm action={deleteCategory} submitLabel="حذف القسم" variant="ghost" confirm="حذف هذا القسم؟">
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
              </div>
            ) : null}
          </Panel>
        ))}
        <Panel title="قسم جديد">
          <ActionForm action={saveCategory} submitLabel="إضافة القسم">
            <CategoryFields c={{ nameAr: "", nameEn: "", slug: "", image: null, sortOrder: categories.length }} />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
