import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { editorOptions, emptyProduct } from "@/lib/admin-products";

export default async function NewProduct() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const options = await editorOptions(lang);
  return (
    <>
      <PageHeader title={tr("منتج جديد", "New product")} />
      <ProductEditor initial={emptyProduct()} {...options} />
    </>
  );
}
