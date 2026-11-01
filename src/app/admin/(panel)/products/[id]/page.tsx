import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { editorOptions, productForEditor } from "@/lib/admin-products";

export default async function EditProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, options] = await Promise.all([productForEditor(id), editorOptions()]);
  if (!product) notFound();

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
      <ProductEditor initial={product} {...options} />
    </>
  );
}
