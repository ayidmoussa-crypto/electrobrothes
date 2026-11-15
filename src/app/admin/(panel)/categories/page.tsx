import { deleteCategory, saveCategory } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { adminTr, type Tr } from "@/lib/admin-lang";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

type Cat = { id?: string; nameAr: string; nameEn: string; slug: string; image: string | null; bannerImages: string[]; sortOrder: number };

function CategoryFields({ c, tr }: { c: Cat; tr: Tr }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <L label={tr("الاسم بالعربية", "Name in Arabic")}>
        <input name="nameAr" defaultValue={c.nameAr} required className={inputClass} />
      </L>
      <L label={tr("الاسم بالإنجليزية", "Name in English")}>
        <input name="nameEn" defaultValue={c.nameEn} required dir="ltr" className={inputClass} />
      </L>
      <L label={tr("الرابط (slug)", "Link (slug)")}>
        <input name="slug" defaultValue={c.slug} dir="ltr" placeholder={tr("تلقائي", "Automatic")} className={inputClass} />
      </L>
      <L label={tr("رابط الصورة", "Image link")}>
        <input name="image" defaultValue={c.image ?? ""} dir="ltr" className={inputClass} />
      </L>
      <L label={tr("الترتيب", "Order")}>
        <input name="sortOrder" type="number" min={0} defaultValue={c.sortOrder} className={inputClass} />
      </L>
      <L
        label={tr("صور البانر ديال صفحة القسم (رابط فكل سطر، حتى 3. خليه خاوي باش تبان 3 من المنتجات ديالو)", "Category page banner pictures (one link per line, up to 3. Leave empty to show three of its products)")}
        className="sm:col-span-5"
      >
        <textarea name="bannerImages" rows={2} defaultValue={c.bannerImages.join("\n")} dir="ltr" placeholder="https://res.cloudinary.com/…" className={`${inputClass} py-2`} />
      </L>
    </div>
  );
}

export default async function CategoriesPage() {
  const [, { tr, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });

  return (
    <>
      <PageHeader title={tr("الأقسام", "Categories")} description={tr("تظهر في القائمة العلوية، الصفحة الرئيسية والفوتر.", "Shown in the top menu, the home page and the footer.")} />
      <div className="flex flex-col gap-4">
        {categories.map((c) => (
          <Panel key={c.id} title={`${ar ? c.nameAr : c.nameEn} · ${tr(`${c._count.products} منتج`, `${c._count.products} products`)}`}>
            <ActionForm action={saveCategory} submitLabel={tr("حفظ", "Save")}>
              <CategoryFields tr={tr} c={c} />
            </ActionForm>
            {c._count.products === 0 ? (
              <div className="mt-2">
                <ActionForm action={deleteCategory} submitLabel={tr("حذف القسم", "Delete category")} variant="ghost" confirm={tr("حذف هذا القسم؟", "Delete this category?")}>
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
              </div>
            ) : null}
          </Panel>
        ))}
        <Panel title={tr("قسم جديد", "New category")}>
          <ActionForm action={saveCategory} submitLabel={tr("إضافة القسم", "Add category")}>
            <CategoryFields tr={tr} c={{ nameAr: "", nameEn: "", slug: "", image: null, bannerImages: [], sortOrder: categories.length }} />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
