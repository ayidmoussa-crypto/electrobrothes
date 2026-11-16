import "server-only";
import type { OfferInitial, OfferProductOption } from "@/components/admin/OfferEditor";
import { db } from "./db";
import { isOfferStyle } from "./offers";
import { toMoroccanInput } from "./time";

/** Products an offer can show: on sale, with their photos and whether their offer page is live. */
export async function offerProductOptions(lang: "ar" | "en"): Promise<OfferProductOption[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, images: { some: {} } },
    orderBy: { nameAr: "asc" },
    select: { id: true, nameAr: true, nameEn: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 6 }, landingPage: { select: { publishedAt: true } } },
  });
  return rows.map((p) => ({ id: p.id, name: lang === "en" ? p.nameEn : p.nameAr, images: p.images.map((i) => i.url), hasPage: !!p.landingPage?.publishedAt }));
}

/** A saved offer as the editor's form expects it, or a blank one. */
export async function offerInitial(id?: string): Promise<OfferInitial | null> {
  if (!id) return { name: "", productId: "", style: "dark", titleAr: "", titleEn: "", sublineAr: "", sublineEn: "", image: "", link: "product", startsAt: "", endsAt: "", sortOrder: 0, isPublished: false };
  const o = await db.offer.findUnique({ where: { id } });
  if (!o) return null;
  return {
    id: o.id,
    name: o.name,
    productId: o.productId,
    style: isOfferStyle(o.style) ? o.style : "dark",
    titleAr: o.titleAr,
    titleEn: o.titleEn,
    sublineAr: o.sublineAr,
    sublineEn: o.sublineEn,
    image: o.image ?? "",
    link: o.link === "page" ? "page" : "product",
    startsAt: o.startsAt ? toMoroccanInput(o.startsAt, 16) : "",
    endsAt: o.endsAt ? toMoroccanInput(o.endsAt, 16) : "",
    sortOrder: o.sortOrder,
    isPublished: o.isPublished,
  };
}
