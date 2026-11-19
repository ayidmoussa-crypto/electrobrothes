import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { saveSupportGuide } from "@/app/actions/admin-support";
import { ActionForm } from "@/components/admin/ActionForm";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { SUPPORT_GUIDE_MAX } from "@/lib/support/rules";
import { ExternalRatings } from "@/components/admin/ExternalRatings";
import { SeoPanel } from "@/components/admin/SeoSuggestions";
import { StockHistory } from "@/components/admin/StockHistory";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { editorOptions, productForEditor, stockHistory } from "@/lib/admin-products";
import { db } from "@/lib/db";
import { isStaleRating } from "@/lib/reviews/rules";
import { seoProductDetail } from "@/lib/seo-content/service";
import { TIME_ZONE } from "@/lib/time";


export default async function EditProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const [, { tr, lang, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const checkedDate = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeZone: TIME_ZONE });
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, options, history, seo, external, guide] = await Promise.all([
    productForEditor(id),
    editorOptions(lang),
    stockHistory(id),
    seoProductDetail(id, lang),
    db.externalRating.findMany({ where: { productId: id }, orderBy: [{ status: "asc" }, { source: "asc" }] }),
    db.product.findUnique({ where: { id }, select: { supportGuide: true } }),
  ]);
  if (!product || !seo) notFound();
  const missing = [
    ...seo.checks.ar.filter((c) => c.status !== "good").map((c) => ({ label: `${c.label} (${tr("العربية", "Arabic")}): ${c.hint}`, points: c.weight })),
    ...seo.checks.en.filter((c) => c.status !== "good").map((c) => ({ label: `${c.label} (English): ${c.hint}`, points: c.weight })),
  ];

  return (
    <>
      <PageHeader
        title={ar ? product.nameAr : product.nameEn}
        description={sp.created ? tr("تم إنشاء المنتج بنجاح.", "Product created.") : undefined}
        actions={
          <a href={`/products/${product.slug}`} target="_blank" className={buttonClass({ variant: "outline" })}>
            <ExternalLink className="size-4" aria-hidden="true" />
            {tr("عرض في المتجر", "View in shop")}
          </a>
        }
      />
      <div className="mb-6">
        <SeoPanel productId={id} score={seo.score} missing={missing} changes={seo.changes} />
      </div>
      <div className="mb-6">
        <ExternalRatings
          productId={id}
          rows={external.map((r) => ({
            id: r.id,
            source: r.source,
            url: r.url,
            rating: r.rating,
            ratingMax: r.ratingMax,
            ratingCount: r.ratingCount,
            summaryAr: r.summaryAr,
            summaryEn: r.summaryEn,
            status: r.status,
            lastChecked: checkedDate.format(r.lastCheckedAt),
            stale: isStaleRating(r.lastCheckedAt),
            suggestedByAi: r.suggestedByAi,
          }))}
        />
      </div>
      <ProductEditor initial={product} {...options} />
      <section id="support-guide" className="admin-card mt-6 scroll-mt-40 p-4">
        <h2 className="text-base">{tr("ملاحظات الدعم التقني (اختياري)", "Technical support notes (optional)")}</h2>
        <p className="mt-1 mb-3 text-sm text-warm-600">
          {tr(
            "ماشي ضروري: المساعد كيفهم المشكل وكيعطي الحلول بالمعرفة التقنية ديالو. إلا عندك تجربة خاصة مع هاد المنتوج (طريقة الفورمات ديالو، مشكل كيتعاود بزاف)، كتبها هنا وهو غادي يقدمها. ما كتبانش فالمتجر.",
            "Not required: the assistant understands the problem and suggests fixes from its own technical knowledge. If you have your own experience with this product (its reset method, a problem that keeps coming back), write it here and it will come first. Never shown in the shop.",
          )}
        </p>
        <ActionForm action={saveSupportGuide} submitLabel={tr("حفظ الملاحظات", "Save notes")} variant="dark">
          <input type="hidden" name="productId" value={id} />
          <label htmlFor="supportGuide" className="sr-only">
            {tr("دليل الأعطاب", "Troubleshooting notes")}
          </label>
          <textarea id="supportGuide" name="supportGuide" rows={8} maxLength={SUPPORT_GUIDE_MAX} defaultValue={guide?.supportGuide ?? ""} className="admin-field w-full rounded-lg px-3 py-2.5 text-base text-warm-800" />
        </ActionForm>
      </section>
      <div className="mt-6">
        <StockHistory rows={history} lang={lang} />
      </div>
    </>
  );
}
