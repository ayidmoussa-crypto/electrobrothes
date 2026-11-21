import { BundleForm, EMPTY_BUNDLE } from "@/components/admin/BundleForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { bundleProductOptions, uploadsEnabled } from "@/lib/admin-bundles";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("باك جديد", "New bundle");

export default async function NewBundlePage() {
  const [, { tr }] = await Promise.all([requireAdmin(), adminTr()]);
  const products = await bundleProductOptions();
  return (
    <>
      <PageHeader
        title={tr("باك جديد", "New bundle")}
        description={tr("اختار المنتجات وحدد ثمن الباك. الخصم كيتحسب بوحدو فالسلة ملي يكونو كاع المنتجات فيها.", "Pick the products and set the bundle price. The discount is applied in the cart on its own once all the products are in it.")}
      />
      <BundleForm initial={EMPTY_BUNDLE} products={products} uploadsEnabled={uploadsEnabled()} />
    </>
  );
}
