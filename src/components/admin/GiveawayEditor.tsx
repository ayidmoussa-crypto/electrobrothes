"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useActionState, useState } from "react";
import { saveGiveaway } from "@/app/actions/admin-giveaways";
import { buttonClass } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/forms";
import { useAdminTr } from "./AdminLang";
import { FormMessage, inputClass, L } from "./ui";
import { uploadImage } from "@/lib/upload-client";

export type GiveawayProductOption = { id: string; nameAr: string; nameEn: string; image: string | null };

export type GiveawayFormValues = {
  id?: string;
  titleAr: string;
  titleEn: string;
  prizeAr: string;
  prizeEn: string;
  detailsAr: string;
  detailsEn: string;
  image: string;
  liveUrl: string;
  productId: string;
  prizeValue: number | "";
  /** "YYYY-MM-DDTHH:mm", Moroccan time. */
  drawAt: string;
  isPublished: boolean;
  drawn: boolean;
};

export const EMPTY_GIVEAWAY: GiveawayFormValues = {
  titleAr: "",
  titleEn: "",
  prizeAr: "",
  prizeEn: "",
  detailsAr: "",
  detailsEn: "",
  image: "",
  liveUrl: "",
  productId: "",
  prizeValue: "",
  drawAt: "",
  isPublished: true,
  drawn: false,
};

export function GiveawayEditor({ initial, products, uploadsEnabled }: { initial: GiveawayFormValues; products: GiveawayProductOption[]; uploadsEnabled: boolean }) {
  const [state, action, pending] = useActionState(saveGiveaway, {});
  const { tr } = useAdminTr();
  const [productId, setProductId] = useState(initial.productId);
  const [prizeAr, setPrizeAr] = useState(initial.prizeAr);
  const [prizeEn, setPrizeEn] = useState(initial.prizeEn);
  const [image, setImage] = useState(initial.image);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const product = products.find((p) => p.id === productId);
  const shown = image || product?.image || "";

  function pickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    // The prize names follow the product until the owner types their own.
    if (p && (!prizeAr || products.some((x) => x.nameAr === prizeAr))) setPrizeAr(p.nameAr);
    if (p && (!prizeEn || products.some((x) => x.nameEn === prizeEn))) setPrizeEn(p.nameEn);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadImage(file);
      setImage(url);
    } catch {
      setUploadError(tr("فشل رفع الصورة. جرب مرة أخرى ولا حط رابط.", "Image upload failed. Try again or add a link."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="flex flex-col gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <section className="admin-card p-4 md:p-5">
        <h2 className="mb-3 text-base">{tr("الجائزة", "The prize")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <L label={tr("منتج من المتجر (اختياري)", "A shop product (optional)")} className="md:col-span-2">
            <select name="productId" value={productId} onChange={(e) => pickProduct(e.target.value)} className={inputClass}>
              <option value="">{tr("— جائزة ماشي من المتجر —", "— Not a shop product —")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>
          </L>
          <L label={tr("سمية الجائزة بالعربية", "Prize name in Arabic")}>
            <input name="prizeAr" value={prizeAr} onChange={(e) => setPrizeAr(e.target.value)} required maxLength={120} className={inputClass} />
          </L>
          <L label={tr("سمية الجائزة بالإنجليزية", "Prize name in English")}>
            <input name="prizeEn" value={prizeEn} onChange={(e) => setPrizeEn(e.target.value)} required maxLength={120} dir="ltr" className={inputClass} />
          </L>
          <L label={tr("القيمة بالدرهم (اختياري)", "Value in MAD (optional)")}>
            <input name="prizeValue" type="number" min={1} defaultValue={initial.prizeValue} className={inputClass} />
          </L>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-xl border border-warm-200 bg-white">
            {shown ? (
              <Image src={shown} alt="" fill sizes="112px" unoptimized={shown.endsWith(".svg")} className="object-contain p-2" />
            ) : (
              <span className="grid h-full place-items-center p-2 text-center text-xs text-warm-500">{tr("بلا صورة", "No image")}</span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <L label={product ? tr("صورة خاصة (خليها خاوية باش تبان صورة المنتج)", "Own image (leave empty to use the product's)") : tr("صورة الجائزة", "Prize image")}>
              <input name="image" value={image} onChange={(e) => setImage(e.target.value)} dir="ltr" placeholder="https://res.cloudinary.com/…" className={inputClass} />
            </L>
            {uploadsEnabled ? (
              <label className={buttonClass({ variant: "outline", className: "w-fit cursor-pointer" })}>
                {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
                {tr("رفع صورة", "Upload image")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
              </label>
            ) : null}
            {uploadError ? <p className="text-sm text-danger">{uploadError}</p> : null}
          </div>
        </div>
      </section>

      <section className="admin-card p-4 md:p-5">
        <h2 className="mb-3 text-base">{tr("السحب", "The draw")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <L label={tr("العنوان بالعربية", "Title in Arabic")}>
            <input name="titleAr" defaultValue={initial.titleAr} required maxLength={120} placeholder={tr("مثلاً: اربح سماعة Soundcore Q45", "e.g. اربح سماعة Soundcore Q45")} className={inputClass} />
          </L>
          <L label={tr("العنوان بالإنجليزية", "Title in English")}>
            <input name="titleEn" defaultValue={initial.titleEn} required maxLength={120} dir="ltr" placeholder="Win a Soundcore Q45" className={inputClass} />
          </L>
          <L label={tr("وقت السحب (بتوقيت المغرب) · التسجيل كيتسد فيه", "Draw time (Morocco time) · entries close then")}>
            <input name="drawAt" type="datetime-local" defaultValue={initial.drawAt} required disabled={initial.drawn} className={inputClass} />
            {initial.drawn ? <input type="hidden" name="drawAt" value={initial.drawAt} /> : null}
          </L>
          <L label={tr("رابط البث: حساب Instagram ولا TikTok (اختياري)", "Live link: Instagram or TikTok account (optional)")}>
            <input name="liveUrl" defaultValue={initial.liveUrl} dir="ltr" placeholder="https://www.instagram.com/…" className={inputClass} />
          </L>
          <L label={tr("تفاصيل إضافية بالعربية (اختياري)", "Extra details in Arabic (optional)")}>
            <textarea name="detailsAr" defaultValue={initial.detailsAr} maxLength={1500} rows={3} className={`${inputClass} py-2`} />
          </L>
          <L label={tr("تفاصيل إضافية بالإنجليزية (اختياري)", "Extra details in English (optional)")}>
            <textarea name="detailsEn" defaultValue={initial.detailsEn} maxLength={1500} rows={3} dir="ltr" className={`${inputClass} py-2`} />
          </L>
        </div>
        <p className="mt-3 text-xs text-warm-600">
          {tr(
            "الشروط العادية (مجاني، مشاركة وحدة لكل رقم، واتساب، 48 ساعة للرد، ماشي تابع لإنستغرام ولا تيك توك) كتبان بوحدها فصفحة السحب.",
            "The standard rules (free, one entry per number, WhatsApp, 48 hours to answer, not tied to Instagram or TikTok) show on their own on the giveaway page.",
          )}
        </p>
        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-warm-800">
          <input type="checkbox" name="isPublished" defaultChecked={initial.isPublished} className="size-5 accent-ink" />
          {tr("ظاهر فالمتجر", "Visible in the shop")}
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || uploading} className={buttonClass()}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {initial.id ? tr("حفظ", "Save") : tr("إطلاق السحب", "Launch the giveaway")}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
