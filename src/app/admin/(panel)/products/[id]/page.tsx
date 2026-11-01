import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { SeoPanel } from "@/components/admin/SeoSuggestions";
import { StockHistory } from "@/components/admin/StockHistory";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { editorOptions, productForEditor, stockHistory } from "@/lib/admin-products";
import { db } from "@/lib/db";
import { seoScore } from "@/lib/seo-content/rules";
import { contentSelect, productChanges } from "@/lib/seo-content/service";

export default async function EditProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, options, history, content, [changes]] = await Promise.all([
    productForEditor(id),
    editorOptions(),
    stockHistory(id),
    db.product.findUnique({ where: { id }, select: { ...contentSelect, _count: { select: { specs: true, faqs: true } } } }),
    productChanges(id),
  ]);
  if (!product || !content) notFound();
  const { score, missing } = seoScore({ ...content, specCount: content._count.specs, faqCount: content._count.faqs });

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
        <SeoPanel productId={id} score={score} missing={missing} changes={changes ?? null} />
      </div>
      <ProductEditor initial={product} {...options} />
      <div className="mt-6">
        <StockHistory rows={history} />
      </div>
    </>
  );
}
