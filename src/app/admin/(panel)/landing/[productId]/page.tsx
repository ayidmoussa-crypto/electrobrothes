import { notFound } from "next/navigation";
import { LandingEditor } from "@/components/admin/LandingEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { draftOf } from "@/lib/landing-data";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("صفحة الهبوط", "Landing page");

export default async function LandingEditPage({ params }: PageProps<"/admin/landing/[productId]">) {
  const [{ productId }, , { tr, lang }] = await Promise.all([params, requireAdmin(), adminTr()]);
  const p = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      descriptionAr: true,
      highlightsAr: true,
      specs: { select: { key: true, valueAr: true }, orderBy: { sortOrder: "asc" } },
      faqs: { select: { questionAr: true, answerAr: true }, orderBy: { sortOrder: "asc" } },
      landingPage: { select: { template: true, sections: true, content: true, published: true, publishedAt: true, updatedAt: true, model: true } },
    },
  });
  if (!p) notFound();

  return (
    <>
      <PageHeader
        title={`${tr("صفحة الهبوط:", "Landing page:")} ${lang === "en" ? p.nameEn : p.nameAr}`}
        description={
          p.landingPage
            ? tr("عدّل، شوف المعاينة، ومن بعد انشر. الزبناء كيشوفو غير النسخة المنشورة.", "Edit, preview, then publish. Shoppers only see the published version.")
            : tr("هادي مسودة أولى من معلومات المنتج نيت. ما تتحفظ حتى تضغط «حفظ المسودة».", "A first draft from the product's own data. Nothing is saved until you click “Save draft”.")
        }
      />
      <LandingEditor productId={p.id} slug={p.slug} initial={draftOf(p)} publishedAt={p.landingPage?.publishedAt?.toISOString() ?? null} />
    </>
  );
}
