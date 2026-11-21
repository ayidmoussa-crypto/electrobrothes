import { notFound } from "next/navigation";
import { OfferEditor } from "@/components/admin/OfferEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { isOfferStyle } from "@/lib/offers";
import { offerInitial, offerProductOptions } from "@/lib/offers-admin";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("العرض", "Campaign");

/** /admin/campaigns/new, or one saved offer. */
export default async function OfferPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]">) {
  const [{ id }, sp, , { tr, lang }] = await Promise.all([params, searchParams, requireAdmin(), adminTr()]);
  const isNew = id === "new";
  const [loaded, products] = await Promise.all([offerInitial(isNew ? undefined : id), offerProductOptions(lang)]);
  if (!loaded) notFound();
  // An AI idea opens a new offer already filled in (product, title, line, look); nothing is saved until "حفظ".
  const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 160) : "");
  const style = q("style");
  const initial =
    isNew && q("product") && products.some((p) => p.id === q("product"))
      ? { ...loaded, productId: q("product"), titleAr: q("title").slice(0, 80), sublineAr: q("subline"), name: q("title").slice(0, 80), style: isOfferStyle(style) ? style : loaded.style }
      : loaded;
  return (
    <>
      <PageHeader
        title={isNew ? tr("عرض جديد", "New offer") : `${tr("العرض:", "Offer:")} ${initial.name}`}
        description={tr("كيبان فوق الصفحة الرئيسية ملي يكون منشور وبين التاريخين.", "Shown at the top of the home page while published and between its dates.")}
      />
      <OfferEditor initial={initial} products={products} />
    </>
  );
}
