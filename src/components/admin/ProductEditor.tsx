"use client";

import { ArrowDown, ArrowUp, CircleAlert, ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState, useState } from "react";
import { deleteProduct, saveProduct, type ProductFormState } from "@/app/actions/admin-products";
import { buttonClass } from "@/components/ui/button";
import { slugify, type ProductInput } from "@/lib/product-input";
import { ActionForm } from "./ActionForm";
import { FormMessage } from "./ui";

type Option = { id: string; label: string };
type Variant = ProductInput["variants"][number];
type Spec = ProductInput["specs"][number];
type Img = ProductInput["images"][number];

const KNOWN_SPECS = ["ram", "storage", "screen", "cpu", "gpu", "camera", "battery", "type", "anc", "connectivity", "power", "port", "capacity", "length", "water"];

const input = "min-h-11 w-full rounded-lg border border-warm-200 bg-warm-100 px-3 text-base text-warm-800 focus:bg-white";
const labelCls = "flex flex-col gap-1 text-sm font-semibold text-ink";
const iconBtn = "grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-warm-600 hover:bg-warm-100 hover:text-ink disabled:opacity-40";

const emptyVariant = (): Variant => ({ sku: "", colorAr: "", colorEn: "", colorHex: "", storage: "", price: "", compareAtPrice: "", stock: "0" });

function move<T>(list: T[], i: number, by: number) {
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(i + by, 0, item);
  return next;
}

export function ProductEditor({
  initial,
  categories,
  brands,
  uploadsEnabled,
}: {
  initial: ProductInput;
  categories: Option[];
  brands: Option[];
  uploadsEnabled: boolean;
}) {
  const [p, setP] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, {});

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const setVariant = (i: number, patch: Partial<Variant>) => set("variants", p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const setSpec = (i: number, patch: Partial<Spec>) => set("specs", p.specs.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setImage = (i: number, patch: Partial<Img>) => set("images", p.images.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of [...files].slice(0, 6)) {
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
        setP((prev) => ({ ...prev, images: [...prev.images, { url: res.secure_url, altAr: prev.nameAr, altEn: prev.nameEn }] }));
      }
    } catch {
      setUploadError("فشل رفع الصورة. تحقق من إعدادات Cloudinary أو استعمل رابطاً.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="payload" value={JSON.stringify(p)} />

        {state.errors?.length ? (
          <div role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">
            <p className="flex items-center gap-2 font-bold">
              <CircleAlert className="size-4" aria-hidden="true" />
              {state.message}
            </p>
            <ul className="mt-2 list-disc ps-6">
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="grid gap-4 rounded-xl border border-warm-200 bg-white p-4 md:grid-cols-2">
          <h2 className="text-base md:col-span-2">المعلومات الأساسية</h2>
          <label className={labelCls}>
            الاسم بالعربية
            <input className={input} value={p.nameAr} onChange={(e) => set("nameAr", e.target.value)} required maxLength={160} />
          </label>
          <label className={labelCls}>
            الاسم بالإنجليزية
            <input
              className={input}
              dir="ltr"
              value={p.nameEn}
              onChange={(e) => {
                set("nameEn", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              required
              maxLength={160}
            />
          </label>
          <label className={labelCls}>
            الرابط (slug)
            <input
              className={input}
              dir="ltr"
              value={p.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
              required
            />
            <span className="text-xs font-normal text-warm-600" dir="ltr">
              /products/{p.slug || "…"}
            </span>
          </label>
          <label className={labelCls}>
            الضمان (بالأشهر)
            <input className={input} type="number" min={0} max={120} value={String(p.warrantyMonths)} onChange={(e) => set("warrantyMonths", e.target.value)} />
          </label>
          <label className={labelCls}>
            القسم
            <select className={input} value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
              <option value="">اختر…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            الماركة
            <select className={input} value={p.brandId} onChange={(e) => set("brandId", e.target.value)} required>
              <option value="">اختر…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelCls} md:col-span-2`}>
            الوصف بالعربية
            <textarea className={`${input} min-h-24 py-2`} value={p.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} maxLength={5000} />
          </label>
          <label className={`${labelCls} md:col-span-2`}>
            الوصف بالإنجليزية
            <textarea className={`${input} min-h-24 py-2`} dir="ltr" value={p.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} maxLength={5000} />
          </label>
          <fieldset className="flex flex-wrap gap-4 md:col-span-2">
            <legend className="sr-only">الظهور</legend>
            {(
              [
                ["isActive", "ظاهر في المتجر"],
                ["isFeatured", "منتج مميز (الواجهة)"],
                ["isBestSeller", "الأكثر مبيعاً"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex min-h-11 items-center gap-2 text-sm text-warm-800">
                <input type="checkbox" checked={p[k]} onChange={(e) => set(k, e.target.checked)} className="size-5 accent-ink" />
                {l}
              </label>
            ))}
          </fieldset>
          <label className={labelCls}>
            نهاية العرض المحدود (اختياري)
            <input className={input} type="datetime-local" value={p.dealEndsAt ?? ""} onChange={(e) => set("dealEndsAt", e.target.value)} />
            <span className="text-xs font-normal text-warm-600">يظهر عداد تنازلي في الصفحة الرئيسية حتى هذا التاريخ.</span>
          </label>
        </section>

        <section className="rounded-xl border border-warm-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base">الصور</h2>
            <div className="flex flex-wrap gap-2">
              {uploadsEnabled ? (
                <label className={buttonClass({ variant: "outline", className: "cursor-pointer" })}>
                  {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
                  رفع صور
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={uploading} />
                </label>
              ) : null}
              <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => set("images", [...p.images, { url: "", altAr: p.nameAr, altEn: p.nameEn }])}>
                <Plus className="size-4" aria-hidden="true" />
                إضافة رابط صورة
              </button>
            </div>
          </div>
          {!uploadsEnabled ? <p className="mb-3 text-xs text-warm-600">رفع الصور يتفعل عند إضافة مفاتيح Cloudinary في ملف .env. حالياً أضف روابط الصور.</p> : null}
          {uploadError ? <p className="mb-3 text-sm text-danger">{uploadError}</p> : null}
          <ul className="flex flex-col gap-3">
            {p.images.map((img, i) => (
              <li key={i} className="flex flex-wrap items-start gap-3 rounded-lg border border-warm-200 p-3">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-warm-50">
                  {img.url.startsWith("https://") || img.url.startsWith("/") ? (
                    <Image src={img.url} alt="" fill sizes="80px" unoptimized className="object-contain p-1" />
                  ) : null}
                </div>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                  <input className={`${input} sm:col-span-3`} dir="ltr" placeholder="https://res.cloudinary.com/…" value={img.url} onChange={(e) => setImage(i, { url: e.target.value })} aria-label={`رابط الصورة ${i + 1}`} />
                  <input className={input} placeholder="وصف بالعربية" value={img.altAr} onChange={(e) => setImage(i, { altAr: e.target.value })} aria-label={`وصف الصورة ${i + 1} بالعربية`} />
                  <input className={input} dir="ltr" placeholder="Alt text (English)" value={img.altEn} onChange={(e) => setImage(i, { altEn: e.target.value })} aria-label={`وصف الصورة ${i + 1} بالإنجليزية`} />
                  {i === 0 ? <span className="self-center text-xs font-semibold text-yellow-800">الصورة الرئيسية</span> : null}
                </div>
                <div className="flex">
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => set("images", move(p.images, i, -1))} aria-label="تقديم الصورة">
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className={iconBtn} disabled={i === p.images.length - 1} onClick={() => set("images", move(p.images, i, 1))} aria-label="تأخير الصورة">
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className={iconBtn} onClick={() => set("images", p.images.filter((_, j) => j !== i))} aria-label="حذف الصورة">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-warm-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base">الخيارات (اللون / السعة) والأسعار والمخزون</h2>
            <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => set("variants", [...p.variants, emptyVariant()])}>
              <Plus className="size-4" aria-hidden="true" />
              خيار جديد
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="text-xs text-warm-600">
                  {["SKU", "اللون (ع)", "اللون (En)", "لون العينة", "السعة", "السعر", "قبل التخفيض", "المخزون", ""].map((h) => (
                    <th key={h} className="px-1 pb-2 text-start font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.variants.map((v, i) => (
                  <tr key={v.id ?? `new-${i}`}>
                    <td className="p-1"><input className={input} dir="ltr" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} aria-label="SKU" /></td>
                    <td className="p-1"><input className={input} value={v.colorAr ?? ""} onChange={(e) => setVariant(i, { colorAr: e.target.value })} aria-label="اللون بالعربية" /></td>
                    <td className="p-1"><input className={input} dir="ltr" value={v.colorEn ?? ""} onChange={(e) => setVariant(i, { colorEn: e.target.value })} aria-label="Color" /></td>
                    <td className="p-1">
                      <input type="color" className="h-11 w-14 cursor-pointer rounded-lg border border-warm-200" value={v.colorHex || ""} onChange={(e) => setVariant(i, { colorHex: e.target.value })} aria-label="لون العينة" />
                    </td>
                    <td className="p-1"><input className={input} dir="ltr" placeholder="128GB" value={v.storage ?? ""} onChange={(e) => setVariant(i, { storage: e.target.value })} aria-label="السعة" /></td>
                    <td className="p-1"><input className={input} type="number" min={1} value={String(v.price)} onChange={(e) => setVariant(i, { price: e.target.value })} aria-label="السعر" /></td>
                    <td className="p-1"><input className={input} type="number" min={0} value={String(v.compareAtPrice ?? "")} onChange={(e) => setVariant(i, { compareAtPrice: e.target.value })} aria-label="السعر قبل التخفيض" /></td>
                    <td className="p-1"><input className={input} type="number" min={0} value={String(v.stock)} onChange={(e) => setVariant(i, { stock: e.target.value })} aria-label="المخزون" /></td>
                    <td className="p-1">
                      <button type="button" className={iconBtn} disabled={p.variants.length === 1} onClick={() => set("variants", p.variants.filter((_, j) => j !== i))} aria-label="حذف الخيار">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-warm-600">الخيار الأول هو الافتراضي. السعر بالدرهم.</p>
        </section>

        <section className="rounded-xl border border-warm-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base">المواصفات التقنية</h2>
            <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => set("specs", [...p.specs, { key: "", valueAr: "", valueEn: "", numericValue: "" }])}>
              <Plus className="size-4" aria-hidden="true" />
              مواصفة جديدة
            </button>
          </div>
          <datalist id="spec-keys">
            {KNOWN_SPECS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <ul className="flex flex-col gap-2">
            {p.specs.map((s, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[9rem_1fr_1fr_7rem_auto]">
                <input className={input} dir="ltr" list="spec-keys" placeholder="ram" value={s.key} onChange={(e) => setSpec(i, { key: e.target.value.toLowerCase() })} aria-label="مفتاح المواصفة" />
                <input className={input} placeholder="8 جيجابايت" value={s.valueAr} onChange={(e) => setSpec(i, { valueAr: e.target.value })} aria-label="القيمة بالعربية" />
                <input className={input} dir="ltr" placeholder="8 GB" value={s.valueEn} onChange={(e) => setSpec(i, { valueEn: e.target.value })} aria-label="القيمة بالإنجليزية" />
                <input className={input} type="number" step="any" placeholder="رقم للفلتر" value={String(s.numericValue ?? "")} onChange={(e) => setSpec(i, { numericValue: e.target.value })} aria-label="قيمة رقمية للفلاتر" />
                <button type="button" className={iconBtn} onClick={() => set("specs", p.specs.filter((_, j) => j !== i))} aria-label="حذف المواصفة">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-warm-600">المفاتيح ram و storage و screen و cpu تظهر كفلاتر في صفحات الأقسام (أدخل القيمة الرقمية: 8، 256، 6.1…).</p>
        </section>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-warm-200 bg-warm-50 py-3">
          <button type="submit" disabled={pending} className={buttonClass({ size: "lg" })}>
            {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
            حفظ المنتج
          </button>
          {!state.errors?.length ? <FormMessage state={state} /> : null}
        </div>
      </form>

      {initial.id ? (
        <section className="rounded-xl border border-danger bg-white p-4">
          <h2 className="text-base text-danger">حذف المنتج</h2>
          <p className="mt-1 text-sm text-warm-600">الطلبات السابقة تحتفظ بنسخة من الاسم والسعر. لإخفائه فقط، ألغِ خيار «ظاهر في المتجر».</p>
          <div className="mt-3">
            <ActionForm action={deleteProduct} submitLabel="حذف نهائياً" variant="outline" confirm="حذف هذا المنتج نهائياً؟ لا يمكن التراجع.">
              <input type="hidden" name="id" value={initial.id} />
            </ActionForm>
          </div>
        </section>
      ) : null}
    </div>
  );
}
