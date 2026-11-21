import Image from "next/image";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("صور العروض", "Campaign images");

/** The shop's own photos: campaign photos used by offers, then every product photo. Uploading happens in an offer. */
export default async function CampaignImages() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const [offers, products] = await Promise.all([
    db.offer.findMany({ where: { image: { not: null } }, select: { id: true, name: true, image: true }, orderBy: { updatedAt: "desc" } }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { nameAr: "asc" },
      select: { id: true, nameAr: true, nameEn: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" } } },
    }),
  ]);
  const tile = (url: string, caption: string) => (
    <li key={url} className="flex flex-col gap-2">
      <span className="relative aspect-square overflow-hidden rounded-xl border border-warm-200 bg-white">
        <Image src={url} alt="" fill sizes="(min-width: 1024px) 12rem, 40vw" unoptimized={url.endsWith(".svg")} className="object-contain p-2" />
      </span>
      <span className="truncate text-xs text-warm-600">{caption}</span>
    </li>
  );

  return (
    <>
      <PageHeader title={tr("مكتبة الصور", "Photo library")} description={tr("غير الصور ديال المتجر. باش ترفع صورة جديدة لحملة، دير داكشي من داخل العرض.", "The shop's own photos only. To upload a new campaign photo, do it from inside an offer.")} />
      <Panel title={tr("صور الحملات", "Campaign photos")} className="mb-6">
        {offers.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{offers.map((o) => tile(o.image!, o.name))}</ul>
        ) : (
          <p className="text-sm text-warm-600">{tr("ما كاين حتى صورة حملة. العروض كتستعمل صورة المنتج.", "No campaign photo yet. Offers use the product photo.")}</p>
        )}
      </Panel>
      <Panel title={tr("صور المنتجات", "Product photos")}>
        <div className="flex flex-col gap-6">
          {products
            .filter((p) => p.images.length)
            .map((p) => (
              <section key={p.id}>
                <h3 className="mb-2 text-sm font-bold text-ink">{lang === "en" ? p.nameEn : p.nameAr}</h3>
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">{p.images.map((i, n) => tile(i.url, `${n + 1}`))}</ul>
              </section>
            ))}
        </div>
      </Panel>
    </>
  );
}
