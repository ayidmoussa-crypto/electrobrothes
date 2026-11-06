import { BundleForm, EMPTY_BUNDLE } from "@/components/admin/BundleForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { bundleProductOptions, uploadsEnabled } from "@/lib/admin-bundles";

export default async function NewBundlePage() {
  await requireAdmin();
  const products = await bundleProductOptions();
  return (
    <>
      <PageHeader title="باك جديد" description="اختار المنتجات وحدد ثمن الباك. الخصم كيتحسب بوحدو فالسلة ملي يكونو كاع المنتجات فيها." />
      <BundleForm initial={EMPTY_BUNDLE} products={products} uploadsEnabled={uploadsEnabled()} />
    </>
  );
}
