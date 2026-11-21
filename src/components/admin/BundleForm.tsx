"use client";

import { Select } from "@/components/ui/Select";
import { ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState, useState } from "react";
import { saveBundle } from "@/app/actions/admin-bundles";
import { buttonClass } from "@/components/ui/button";
import { separatePrice } from "@/lib/bundles";
import { submitKeepingValues } from "@/lib/forms";
import { formatMAD } from "@/lib/money";
import { useAdminTr } from "./AdminLang";
import { FormMessage, inputClass, L } from "./ui";
import { uploadImage } from "@/lib/upload-client";

export type BundleProductOption = { id: string; nameAr: string; minPrice: number; stock: number; image: string | null };

export type BundleFormValues = {
  id?: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  taglineAr: string;
  taglineEn: string;
  image: string;
  price: number | "";
  sortOrder: number;
  isActive: boolean;
  items: { productId: string; quantity: number }[];
};

export const EMPTY_BUNDLE: BundleFormValues = { nameAr: "", nameEn: "", slug: "", taglineAr: "", taglineEn: "", image: "", price: "", sortOrder: 0, isActive: true, items: [] };


export function BundleForm({ initial, products, uploadsEnabled }: { initial: BundleFormValues; products: BundleProductOption[]; uploadsEnabled: boolean }) {
  const [state, action, pending] = useActionState(saveBundle, {});
  const { tr, lang } = useAdminTr();
  const mad = (v: number) => formatMAD(v, lang);
  const [items, setItems] = useState(initial.items);
  const [price, setPrice] = useState<number | "">(initial.price);
  const [image, setImage] = useState(initial.image);
  const [pick, setPick] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const byId = new Map(products.map((p) => [p.id, p]));
  const chosen = items.map((i) => ({ ...i, p: byId.get(i.productId) })).filter((i) => i.p);
  const separate = separatePrice(chosen.map((i) => ({ quantity: i.quantity, minPrice: i.p!.minPrice })));
  const saving = typeof price === "number" ? separate - price : 0;

  const add = () => {
    if (!pick || items.some((i) => i.productId === pick)) return;
    setItems([...items, { productId: pick, quantity: 1 }]);
    setPick("");
  };

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
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <section className="admin-card relative z-10 p-4 md:p-5">
        <h2 className="mb-3 text-base">{tr("المنتجات ديال الباك", "Bundle products")}</h2>
        <div className="flex flex-wrap gap-2">
          <Select value={pick} onChange={(e) => setPick(e.target.value)} className={`${inputClass} flex-1 sm:max-w-md`} aria-label={tr("اختار منتج", "Pick a product")}>
            <option value="">{tr("اختار منتج…", "Pick a product…")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id} disabled={items.some((i) => i.productId === p.id)}>
                {p.nameAr} · {mad(p.minPrice)}
                {p.stock ? "" : tr(" · نفد", " · sold out")}
              </option>
            ))}
          </Select>
          <button type="button" onClick={add} disabled={!pick} className={buttonClass({ variant: "outline" })}>
            <Plus className="size-4" aria-hidden="true" />
            {tr("زيد", "Add")}
          </button>
        </div>

        {chosen.length ? (
          <ul className="mt-4 flex flex-col divide-y divide-warm-200/60">
            {chosen.map((i) => (
              <li key={i.productId} className="flex flex-wrap items-center gap-3 py-2">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white">
                  {i.p!.image ? <Image src={i.p!.image} alt="" fill sizes="48px" unoptimized={i.p!.image.endsWith(".svg")} className="object-contain p-1" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{i.p!.nameAr}</p>
                  <p className="text-xs text-warm-600">
                    {mad(i.p!.minPrice)} {tr("للواحد", "each")}
                    {i.p!.stock < i.quantity ? <b className="text-danger"> · {tr("المخزون ما كافيش", "not enough stock")}</b> : null}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-warm-600">
                  {tr("الكمية", "Quantity")}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={i.quantity}
                    onChange={(e) => setItems(items.map((x) => (x.productId === i.productId ? { ...x, quantity: Math.min(10, Math.max(1, Number(e.target.value) || 1)) } : x)))}
                    className={`${inputClass} w-20`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setItems(items.filter((x) => x.productId !== i.productId))}
                  aria-label={tr(`حيد ${i.p!.nameAr}`, `Remove ${i.p!.nameAr}`)}
                  className={buttonClass({ variant: "ghost", size: "icon" })}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-warm-600">{tr("زيد جوج منتجات ولا كثر، ولا منتج واحد بكمية 2 باش يولي باك.", "Add two products or more, or one product with quantity 2, to make a bundle.")}</p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <L label={tr("ثمن الباك (درهم)", "Bundle price (MAD)")}>
            <input
              name="price"
              type="number"
              min={1}
              required
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputClass}
            />
          </L>
          <div className="flex flex-col justify-end text-sm">
            <span className="text-warm-600">{tr("بالتفريق", "Separately")}</span>
            <b className="text-ink">{mad(separate)}</b>
          </div>
          <div className="flex flex-col justify-end text-sm">
            <span className="text-warm-600">{tr("الزبون كيوفر", "Customer saves")}</span>
            <b className={saving > 0 ? "text-success" : "text-danger"}>
              {typeof price === "number" && separate ? (saving > 0 ? `${mad(saving)} (${Math.round((saving / separate) * 100)}%)` : tr("الثمن خاصو يكون أقل", "The price must be lower")) : "—"}
            </b>
          </div>
        </div>
      </section>

      <section className="admin-card p-4 md:p-5">
        <h2 className="mb-3 text-base">{tr("الاسم والصورة", "Name & image")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <L label={tr("الاسم بالعربية", "Name in Arabic")}>
            <input name="nameAr" defaultValue={initial.nameAr} required maxLength={120} className={inputClass} />
          </L>
          <L label={tr("الاسم بالإنجليزية", "Name in English")}>
            <input name="nameEn" defaultValue={initial.nameEn} required maxLength={120} dir="ltr" className={inputClass} />
          </L>
          <L label={tr("جملة قصيرة بالعربية (اختياري)", "Short line in Arabic (optional)")}>
            <input name="taglineAr" defaultValue={initial.taglineAr} maxLength={200} className={inputClass} />
          </L>
          <L label={tr("جملة قصيرة بالإنجليزية (اختياري)", "Short line in English (optional)")}>
            <input name="taglineEn" defaultValue={initial.taglineEn} maxLength={200} dir="ltr" className={inputClass} />
          </L>
          <L label={tr("الرابط (slug) · كيتعمر من الاسم الإنجليزي إلا خليتيه خاوي", "Link (slug) · filled from the English name when left empty")}>
            <input name="slug" defaultValue={initial.slug} maxLength={120} dir="ltr" className={inputClass} />
          </L>
          <L label={tr("الترتيب (الصغير كيبان الأول)", "Order (smallest shows first)")}>
            <input name="sortOrder" type="number" min={0} max={1000} defaultValue={initial.sortOrder} className={inputClass} />
          </L>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-xl border border-warm-200 bg-white">
            {image ? <Image src={image} alt="" fill sizes="112px" unoptimized={image.endsWith(".svg")} className="object-contain p-2" /> : <span className="grid h-full place-items-center p-2 text-center text-xs text-warm-500">{tr("بلا صورة: كتبان صور المنتجات", "No image: the products' photos show")}</span>}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <L label={tr("صورة الباك (اختياري)", "Bundle image (optional)")}>
              <input name="image" value={image} onChange={(e) => setImage(e.target.value)} dir="ltr" placeholder="https://res.cloudinary.com/…" className={inputClass} />
            </L>
            {uploadsEnabled ? (
              <label className={buttonClass({ variant: "outline", className: "w-fit cursor-pointer" })}>
                {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
                {tr("رفع صورة", "Upload image")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
              </label>
            ) : null}
            {image ? (
              <button type="button" onClick={() => setImage("")} className={buttonClass({ variant: "outline", className: "w-fit cursor-pointer" })}>
                <Trash2 className="size-4" aria-hidden="true" />
                {tr("حيد الصورة", "Remove image")}
              </button>
            ) : null}
            {uploadError ? <p className="text-sm text-danger">{uploadError}</p> : null}
          </div>
        </div>

        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-warm-800">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="size-5 accent-ink" />
          {tr("ظاهر فالمتجر", "Visible in the shop")}
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !items.length} className={buttonClass()}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {initial.id ? tr("حفظ", "Save") : tr("إضافة الباك", "Add bundle")}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
