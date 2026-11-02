import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { ExternalRatings } from "@/components/admin/ExternalRatings";
import { SeoPanel } from "@/components/admin/SeoSuggestions";
import { StockHistory } from "@/components/admin/StockHistory";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { editorOptions, productForEditor, stockHistory } from "@/lib/admin-products";
import { db } from "@/lib/db";
import { isStaleRating } from "@/lib/reviews/rules";
import { seoProductDetail } from "@/lib/seo-content/service";
import { TIME_ZONE } from "@/lib/time";

const checkedDate = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeZone: TIME_ZONE });

export default async function EditProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, options, history, seo, external] = await Promise.all([
    productForEditor(id),
    editorOptions(),
    stockHistory(id),
    seoProductDetail(id),
    db.externalRating.findMany({ where: { productId: id }, orderBy: [{ status: "asc" }, { source: "asc" }] }),
  ]);
  if (!product || !seo) notFound();
  const missing = [
    ...seo.checks.ar.filter((c) => c.status !== "good").map((c) => ({ label: `${c.label} (العربية): ${c.hint}`, points: c.weight })),
    ...seo.checks.en.filter((c) => c.status !== "good").map((c) => ({ label: `${c.label} (English): ${c.hint}`, points: c.weight })),
  ];

  return (
    <>
      <PageHeader
        title={product.nameAr}
        description={sp.created ? "تم إنشاء المنتج بنجاح." : undefined}
        actions={
          <a href={`/products/${product.slug}`} target="_blank" className={buttonClass({ variant: "outline" })}>
            <ExternalLink className="size-4" aria-hidden="true" />
            عرض في المتجر
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
      <div className="mt-6">
        <StockHistory rows={history} />
      </div>
    </>
  );
}
