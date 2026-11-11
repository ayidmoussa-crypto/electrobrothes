import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteBundle } from "@/app/actions/admin-bundles";
import { ActionForm } from "@/components/admin/ActionForm";
import { BundleForm } from "@/components/admin/BundleForm";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { bundleProductOptions, uploadsEnabled } from "@/lib/admin-bundles";
import { db } from "@/lib/db";

export default async function EditBundlePage({ params, searchParams }: PageProps<"/admin/bundles/[id]">) {
  const [, { tr, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [bundle, products] = await Promise.all([
    db.bundle.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" }, select: { productId: true, quantity: true } } } }),
    bundleProductOptions(),
  ]);
  if (!bundle) notFound();

  return (
    <>
      <PageHeader
        title={ar ? bundle.nameAr : bundle.nameEn}
        description={sp.saved ? tr("تزاد الباك. تقدر تبدل فيه هنا.", "Bundle added. You can edit it here.") : tr("تعديل الباك", "Edit bundle")}
        actions={
          <a href={`/bundles/${bundle.slug}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline" })}>
            <ExternalLink className="size-4" aria-hidden="true" />
            {tr("شوفو فالمتجر", "See it in the shop")}
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
      <ActionForm action={deleteBundle} submitLabel={tr("حذف الباك", "Delete bundle")}
        variant="ghost"
        className="mt-6"
        confirm={tr(`حذف الباك «${bundle.nameAr}»؟ الطلبات القديمة ما كتأثرش.`, `Delete the bundle “${bundle.nameEn}”? Past orders are not affected.`)}>
        <input type="hidden" name="id" value={bundle.id} />
      </ActionForm>
    </>
  );
}
