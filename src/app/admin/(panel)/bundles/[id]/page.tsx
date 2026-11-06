import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteBundle } from "@/app/actions/admin-bundles";
import { ActionForm } from "@/components/admin/ActionForm";
import { BundleForm } from "@/components/admin/BundleForm";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { bundleProductOptions, uploadsEnabled } from "@/lib/admin-bundles";
import { db } from "@/lib/db";

export default async function EditBundlePage({ params, searchParams }: PageProps<"/admin/bundles/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [bundle, products] = await Promise.all([
    db.bundle.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" }, select: { productId: true, quantity: true } } } }),
    bundleProductOptions(),
  ]);
  if (!bundle) notFound();

  return (
    <>
      <PageHeader
        title={bundle.nameAr}
        description={sp.saved ? "تزاد الباك. تقدر تبدل فيه هنا." : "تعديل الباك"}
        actions={
          <a href={`/bundles/${bundle.slug}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline" })}>
            <ExternalLink className="size-4" aria-hidden="true" />
            شوفو فالمتجر
          </a>
        }
      />
      <BundleForm
        products={products}
        uploadsEnabled={uploadsEnabled()}
        initial={{
          id: bundle.id,
          nameAr: bundle.nameAr,
          nameEn: bundle.nameEn,
          slug: bundle.slug,
          taglineAr: bundle.taglineAr ?? "",
          taglineEn: bundle.taglineEn ?? "",
          image: bundle.image ?? "",
          price: bundle.price,
          sortOrder: bundle.sortOrder,
          isActive: bundle.isActive,
          items: bundle.items,
        }}
      />
      <ActionForm action={deleteBundle} submitLabel="حذف الباك" variant="ghost" className="mt-6" confirm={`حذف الباك «${bundle.nameAr}»؟ الطلبات القديمة ما كتأثرش.`}>
        <input type="hidden" name="id" value={bundle.id} />
      </ActionForm>
    </>
  );
}
