"use client";

import { ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState, useState } from "react";
import { saveBundle } from "@/app/actions/admin-bundles";
import { buttonClass } from "@/components/ui/button";
import { separatePrice } from "@/lib/bundles";
import { submitKeepingValues } from "@/lib/forms";
import { formatMAD } from "@/lib/money";
import { FormMessage, inputClass, L } from "./ui";

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

const mad = (v: number) => formatMAD(v, "ar");

export function BundleForm({ initial, products, uploadsEnabled }: { initial: BundleFormValues; products: BundleProductOption[]; uploadsEnabled: boolean }) {
  const [state, action, pending] = useActionState(saveBundle, {});
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
      const sig = await fetch("/api/admin/upload-signature", { method: "POST" }).then((r) => r.json());
      if (sig.error) throw new Error(sig.error);
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("folder", sig.folder);
      body.append("signature", sig.signature);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body }).then((r) => r.json());
      if (!res.secure_url) throw new Error("upload");
      setImage(res.secure_url);
    } catch {
      setUploadError("فشل رفع الصورة. جرب مرة أخرى ولا حط رابط.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="flex flex-col gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <section className="admin-card relative z-10 p-4 md:p-5">
        <h2 className="mb-3 text-base">المنتجات ديال الباك</h2>
        <div className="flex flex-wrap gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${inputClass} flex-1 sm:max-w-md`} aria-label="اختار منتج">
            <option value="">اختار منتج…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id} disabled={items.some((i) => i.productId === p.id)}>
                {p.nameAr} · {mad(p.minPrice)}
                {p.stock ? "" : " · نفد"}
              </option>
            ))}
          </select>
          <button type="button" onClick={add} disabled={!pick} className={buttonClass({ variant: "outline" })}>
            <Plus className="size-4" aria-hidden="true" />
            زيد
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
                    {mad(i.p!.minPrice)} للواحد{i.p!.stock < i.quantity ? <b className="text-danger"> · المخزون ما كافيش</b> : null}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-warm-600">
                  الكمية
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
                  aria-label={`حيد ${i.p!.nameAr}`}
                  className={buttonClass({ variant: "ghost", size: "icon" })}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-warm-600">زيد جوج منتجات ولا كثر، ولا منتج واحد بكمية 2 باش يولي باك.</p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <L label="ثمن الباك (درهم)">
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
            <span className="text-warm-600">بالتفريق</span>
            <b className="text-ink">{mad(separate)}</b>
          </div>
          <div className="flex flex-col justify-end text-sm">
            <span className="text-warm-600">الزبون كيوفر</span>
            <b className={saving > 0 ? "text-success" : "text-danger"}>
              {typeof price === "number" && separate ? (saving > 0 ? `${mad(saving)} (${Math.round((saving / separate) * 100)}%)` : "الثمن خاصو يكون أقل") : "—"}
            </b>
          </div>
        </div>
      </section>

      <section className="admin-card p-4 md:p-5">
        <h2 className="mb-3 text-base">الاسم والصورة</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <L label="الاسم بالعربية">
            <input name="nameAr" defaultValue={initial.nameAr} required maxLength={120} className={inputClass} />
          </L>
          <L label="الاسم بالإنجليزية">
            <input name="nameEn" defaultValue={initial.nameEn} required maxLength={120} dir="ltr" className={inputClass} />
          </L>
          <L label="جملة قصيرة بالعربية (اختياري)">
            <input name="taglineAr" defaultValue={initial.taglineAr} maxLength={200} className={inputClass} />
          </L>
          <L label="جملة قصيرة بالإنجليزية (اختياري)">
            <input name="taglineEn" defaultValue={initial.taglineEn} maxLength={200} dir="ltr" className={inputClass} />
          </L>
          <L label="الرابط (slug) · كيتعمر من الاسم الإنجليزي إلا خليتيه خاوي">
            <input name="slug" defaultValue={initial.slug} maxLength={120} dir="ltr" className={inputClass} />
          </L>
          <L label="الترتيب (الصغير كيبان الأول)">
            <input name="sortOrder" type="number" min={0} max={1000} defaultValue={initial.sortOrder} className={inputClass} />
          </L>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-xl border border-warm-200 bg-white">
            {image ? <Image src={image} alt="" fill sizes="112px" unoptimized={image.endsWith(".svg")} className="object-contain p-2" /> : <span className="grid h-full place-items-center p-2 text-center text-xs text-warm-500">بلا صورة: كتبان صور المنتجات</span>}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <L label="صورة الباك (اختياري)">
              <input name="image" value={image} onChange={(e) => setImage(e.target.value)} dir="ltr" placeholder="https://res.cloudinary.com/…" className={inputClass} />
            </L>
            {uploadsEnabled ? (
              <label className={buttonClass({ variant: "outline", className: "w-fit cursor-pointer" })}>
                {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
                رفع صورة
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
              </label>
            ) : null}
            {uploadError ? <p className="text-sm text-danger">{uploadError}</p> : null}
          </div>
        </div>

        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-warm-800">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="size-5 accent-ink" />
          ظاهر فالمتجر
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !items.length} className={buttonClass()}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {initial.id ? "حفظ" : "إضافة الباك"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
