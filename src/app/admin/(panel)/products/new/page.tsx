import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { editorOptions, emptyProduct } from "@/lib/admin-products";

export default async function NewProduct() {
  await requireAdmin();
  const options = await editorOptions();
  return (
    <>
      <PageHeader title="منتج جديد" />
      <ProductEditor initial={emptyProduct()} {...options} />
    </>
  );
}
