"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { offerInput } from "@/lib/offers";

export type OfferState = { ok?: boolean; message?: string; id?: string };

const fields = (fd: FormData) => Object.fromEntries([...fd].filter(([, v]) => typeof v === "string"));

function done(id: string) {
  updateTag("offers");
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
}

/** Saves an offer as it is; publishing is its own click. */
export async function saveOffer(_: OfferState, fd: FormData): Promise<OfferState> {
  const admin = await requireAdmin();
  const { tr } = await adminTr();
  const parsed = offerInput.safeParse(fields(fd));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg =
      issue?.message === "image"
        ? tr("الصورة خاصها تكون من صور المتجر (Cloudinary).", "The photo must be one of the shop's own (Cloudinary).")
        : issue?.message === "dates"
          ? tr("تاريخ النهاية خاصو يكون من بعد تاريخ البداية.", "The end date must be after the start date.")
          : tr("تحقق من الخانات المطلوبة.", "Check the required fields.");
    return { ok: false, message: msg };
  }
  const { id, ...data } = parsed.data;
  if (!(await db.product.findUnique({ where: { id: data.productId }, select: { id: true } }))) return { ok: false, message: tr("المنتج ما كاينش.", "The product does not exist.") };
  const saved = id
    ? await db.offer.update({ where: { id }, data: { ...data, updatedBy: admin.email }, select: { id: true } })
    : await db.offer.create({ data: { ...data, updatedBy: admin.email }, select: { id: true } });
  done(saved.id);
  return { ok: true, message: tr("تحفظ العرض.", "Offer saved."), id: saved.id };
}

/** "نشر" / "رجّعو مسودة". A published offer shows only between its dates. */
export async function setOfferPublished(id: string, published: boolean): Promise<OfferState> {
  await requireAdmin();
  const { tr } = await adminTr();
  const offerId = z.string().min(1).max(40).parse(id);
  await db.offer.update({ where: { id: offerId }, data: { isPublished: published } });
  done(offerId);
  return { ok: true, message: published ? tr("العرض منشور.", "Offer published.") : tr("العرض رجع مسودة.", "Offer back to draft.") };
}

/** Deleting an offer keeps its click and order figures (they lose the link to it). */
export async function deleteOffer(id: string): Promise<OfferState> {
  await requireAdmin();
  const { tr } = await adminTr();
  const offerId = z.string().min(1).max(40).parse(id);
  await db.offer.delete({ where: { id: offerId } });
  done(offerId);
  return { ok: true, message: tr("تحذف العرض.", "Offer deleted.") };
}
