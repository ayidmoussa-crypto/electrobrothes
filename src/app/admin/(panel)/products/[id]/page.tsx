import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { SeoPanel } from "@/components/admin/SeoSuggestions";
import { StockHistory } from "@/components/admin/StockHistory";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { editorOptions, productForEditor, stockHistory } from "@/lib/admin-products";
import { seoProductDetail } from "@/lib/seo-content/service";

export default async function EditProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, options, history, seo] = await Promise.all([productForEditor(id), editorOptions(), stockHistory(id), seoProductDetail(id)]);
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
      <ProductEditor initial={product} {...options} />
      <div className="mt-6">
        <StockHistory rows={history} />
      </div>
    </>
  );
}
