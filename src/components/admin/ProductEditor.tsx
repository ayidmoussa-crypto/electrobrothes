"use client";

import { DateField } from "@/components/ui/DateField";
import { Select } from "@/components/ui/Select";
import { ArrowDown, ArrowUp, CircleAlert, ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState, useState } from "react";
import { deleteProduct, saveProduct, type ProductFormState } from "@/app/actions/admin-products";
import { buttonClass } from "@/components/ui/button";
import { colorName } from "@/lib/color-names";
import { submitKeepingValues } from "@/lib/forms";
import { slugify, type ProductInput } from "@/lib/product-input";
import { ActionForm } from "./ActionForm";
import { useAdminTr } from "./AdminLang";
import { FILTER_SPECS, KNOWN_SPECS, SpecPicker } from "./SpecPicker";
import { FormMessage } from "./ui";
import { uploadImage } from "@/lib/upload-client";

type Option = { id: string; label: string };
type Variant = ProductInput["variants"][number];
type Spec = ProductInput["specs"][number];
type Img = ProductInput["images"][number];

const input = "min-h-11 w-full admin-field rounded-lg px-3 text-base text-warm-800";
const labelCls = "flex flex-col gap-1 text-sm font-semibold text-ink";
const iconBtn = "grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-warm-600 hover:bg-white/70 hover:text-ink disabled:opacity-40";

const emptyVariant = (price: Variant["price"] = ""): Variant => ({
  sku: "",
  colorAr: "",
  colorEn: "",
  colorHex: "",
  storage: "",
  price,
  compareAtPrice: "",
  costPrice: "",
  stock: "0",
  stockBase: 0,
  lowStockAt: 3,
});
const num = (v: number | string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// Starting value of the native colour picker: product swatch data (like the seed's colorHex), not a UI colour.
// eslint-disable-next-line no-restricted-syntax
const DEFAULT_SWATCH = "#111111";

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
  // After a save the server re-renders with fresh data (stock, its base, new colour ids): adopt it, so a
  // second save never re-applies the same stock change or re-creates a colour.
  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    setP(initial);
  }
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  // Spec rows where "other spec" was picked and the owner types the key.
  const [customSpecs, setCustomSpecs] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, {});
  const { tr, lang } = useAdminTr();

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
        const url = await uploadImage(file);
        setP((prev) => ({ ...prev, images: [...prev.images, { url: url, altAr: prev.nameAr, altEn: prev.nameEn }] }));
      }
    } catch {
      setUploadError(tr("فشل رفع الصورة. تحقق من إعدادات Cloudinary أو استعمل رابطاً.", "Image upload failed. Check the Cloudinary settings or use a link."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="flex flex-col gap-6">
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

        <section className="grid gap-4 admin-card p-4 md:grid-cols-2">
          <h2 className="text-base md:col-span-2">{tr("المعلومات الأساسية", "Basic information")}</h2>
          <label className={labelCls}>
            {tr("الاسم بالعربية", "Name in Arabic")}
            <input className={input} value={p.nameAr} onChange={(e) => set("nameAr", e.target.value)} required maxLength={160} />
          </label>
          <label className={labelCls}>
            {tr("الاسم بالإنجليزية", "Name in English")}
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
            {tr("الرابط (slug)", "Link (slug)")}
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
            {tr("الضمان بالأشهر (0 = بلا ضمان)", "Warranty in months (0 = none)")}
            <input className={input} type="number" min={0} max={120} value={String(p.warrantyMonths)} onChange={(e) => set("warrantyMonths", e.target.value)} />
          </label>
          <label className={labelCls}>
            {tr("القسم", "Category")}
            <Select className={input} value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
              <option value="">{tr("اختر…", "Choose…")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>
          <label className={labelCls}>
            {tr("الماركة", "Brand")}
            <Select className={input} value={p.brandId} onChange={(e) => set("brandId", e.target.value)} required>
              <option value="">{tr("اختر…", "Choose…")}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </Select>
          </label>
          <label className={`${labelCls} md:col-span-2`}>
            {tr("الوصف بالعربية", "Description in Arabic")}
            <textarea className={`${input} min-h-24 py-2`} value={p.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} maxLength={5000} />
          </label>
          <label className={`${labelCls} md:col-span-2`}>
            {tr("الوصف بالإنجليزية", "Description in English")}
            <textarea className={`${input} min-h-24 py-2`} dir="ltr" value={p.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} maxLength={5000} />
          </label>
          <fieldset className="flex flex-wrap gap-4 md:col-span-2">
            <legend className="sr-only">{tr("الظهور", "Visibility")}</legend>
            {(
              [
                ["isActive", tr("ظاهر في المتجر", "Visible in the shop")],
                ["isFeatured", tr("منتج مميز (الواجهة)", "Featured (home page)")],
                ["isBestSeller", tr("الأكثر مبيعاً", "Best seller")],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex min-h-11 items-center gap-2 text-sm text-warm-800">
                <input type="checkbox" checked={p[k]} onChange={(e) => set(k, e.target.checked)} className="size-5 accent-ink" />
                {l}
              </label>
            ))}
          </fieldset>
          <label className={labelCls}>
            {tr("نهاية العرض المحدود (اختياري)", "Limited deal ends (optional)")}
            <DateField className={input} time lang={lang} value={p.dealEndsAt ?? ""} onChange={(e) => set("dealEndsAt", e.target.value)} />
            <span className="text-xs font-normal text-warm-600">{tr("يظهر عداد تنازلي في الصفحة الرئيسية حتى هذا التاريخ.", "A countdown shows on the home page until this date.")}</span>
          </label>
        </section>

        <section className="admin-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base">{tr("الصور", "Images")}</h2>
            <div className="flex flex-wrap gap-2">
              {uploadsEnabled ? (
                <label className={buttonClass({ variant: "outline", className: "cursor-pointer" })}>
                  {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
                  {tr("رفع صور", "Upload images")}
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={uploading} />
                </label>
              ) : null}
              <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => set("images", [...p.images, { url: "", altAr: p.nameAr, altEn: p.nameEn }])}>
                <Plus className="size-4" aria-hidden="true" />
                {tr("إضافة رابط صورة", "Add image link")}
              </button>
            </div>
          </div>
          {!uploadsEnabled ? <p className="mb-3 text-xs text-warm-600">{tr("رفع الصور يتفعل عند إضافة مفاتيح Cloudinary في ملف .env. حالياً أضف روابط الصور.", "Uploads turn on once the Cloudinary keys are in the .env file. For now, add image links.")}</p> : null}
          {uploadError ? <p className="mb-3 text-sm text-danger">{uploadError}</p> : null}
          <ul className="flex flex-col gap-3">
            {p.images.map((img, i) => (
              <li key={i} className="flex flex-wrap items-start gap-3 admin-field rounded-xl p-3">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-warm-50">
                  {img.url.startsWith("https://") || img.url.startsWith("/") ? (
                    <Image src={img.url} alt="" fill sizes="80px" unoptimized className="object-contain p-1" />
                  ) : null}
                </div>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                  <input className={`${input} sm:col-span-3`} dir="ltr" placeholder="https://res.cloudinary.com/…" value={img.url} onChange={(e) => setImage(i, { url: e.target.value })} aria-label={tr(`رابط الصورة ${i + 1}`, `Image ${i + 1} link`)} />
                  <input className={input} placeholder={tr("وصف بالعربية", "Alt text (Arabic)")} value={img.altAr} onChange={(e) => setImage(i, { altAr: e.target.value })} aria-label={tr(`وصف الصورة ${i + 1} بالعربية`, `Image ${i + 1} alt text in Arabic`)} />
                  <input className={input} dir="ltr" placeholder="Alt text (English)" value={img.altEn} onChange={(e) => setImage(i, { altEn: e.target.value })} aria-label={tr(`وصف الصورة ${i + 1} بالإنجليزية`, `Image ${i + 1} alt text in English`)} />
                  {i === 0 ? <span className="self-center text-xs font-semibold text-yellow-800">{tr("الصورة الرئيسية", "Main image")}</span> : null}
                </div>
                <div className="flex">
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => set("images", move(p.images, i, -1))} aria-label={tr("تقديم الصورة", "Move image up")}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className={iconBtn} disabled={i === p.images.length - 1} onClick={() => set("images", move(p.images, i, 1))} aria-label={tr("تأخير الصورة", "Move image down")}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className={iconBtn} onClick={() => set("images", p.images.filter((_, j) => j !== i))} aria-label={tr("حذف الصورة", "Delete image")}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base">{tr("الألوان والمخزون والأسعار", "Colours, stock & prices")}</h2>
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">
                {tr("الكمية الكلية", "Total quantity")}: {p.variants.reduce((s, v) => s + num(v.stock), 0)}
              </span>
            </div>
            <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => set("variants", [...p.variants, emptyVariant(p.variants[0]?.price ?? "")])}>
              <Plus className="size-4" aria-hidden="true" />
              {tr("إضافة لون", "Add colour")}
            </button>
          </div>

          <label className={`${labelCls} mb-4 max-w-xs`}>
            {tr("سعر الشراء (للمنتج)", "Purchase price (product)")}
            <input className={input} type="number" min={0} inputMode="numeric" placeholder={tr("بالدرهم", "In MAD")} value={String(p.costPrice ?? "")} onChange={(e) => set("costPrice", e.target.value)} />
            <span className="text-xs font-normal text-warm-600">{tr("لا يظهر أبداً في المتجر. يمكن تغييره للون معيّن أسفله.", "Never shown in the shop. Can be changed for one colour below.")}</span>
          </label>

          <ul className="flex flex-col gap-3">
            {p.variants.map((v, i) => {
              const low = num(v.stock) <= num(v.lowStockAt);
              const changed = v.id ? num(v.stock) - v.stockBase : num(v.stock);
              return (
                <li key={v.id ?? `new-${i}`} className="admin-field rounded-2xl p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">
                      <span className="size-5 rounded-full border border-warm-300" style={{ backgroundColor: v.colorHex || "transparent" }} aria-hidden="true" />
                      {v.colorHex ? colorName(v.colorHex)[lang] : (lang === "en" ? v.colorEn : v.colorAr) || (p.variants.length === 1 ? tr("بدون لون", "No colour") : tr(`لون ${i + 1}`, `Colour ${i + 1}`))}
                      {i === 0 ? <span className="text-xs font-normal text-warm-600">{tr("(الافتراضي)", "(default)")}</span> : null}
                      {low ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-text">{tr("مخزون منخفض", "Low stock")}</span> : null}
                    </p>
                    <button type="button" className={iconBtn} disabled={p.variants.length === 1} onClick={() => set("variants", p.variants.filter((_, j) => j !== i))} aria-label={tr(`حذف ${v.colorAr || `اللون ${i + 1}`}`, `Delete ${v.colorEn || `colour ${i + 1}`}`)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {/* Only the swatch: its name (Arabic and English) is given by the server from the colour. */}
                    <fieldset className="flex flex-col gap-1">
                      <legend className="mb-1 text-sm font-semibold text-ink">{tr("اللون", "Colour")}</legend>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-warm-300 bg-white" title={tr("لون آخر", "Another colour")}>
                          <span className="sr-only">{tr("اختر اللون", "Pick the colour")}</span>
                          <input
                            type="color"
                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                            value={v.colorHex || DEFAULT_SWATCH}
                            onChange={(e) => setVariant(i, { colorHex: e.target.value })}
                          />
                          <span className="absolute inset-0 rounded-full" style={{ backgroundColor: v.colorHex || "transparent" }} aria-hidden="true" />
                          {!v.colorHex ? <Plus className="absolute inset-0 m-auto size-4 text-warm-500" aria-hidden="true" /> : null}
                        </label>
                      </div>
                      <span className="flex items-center gap-2 text-xs text-warm-600">
                        {v.colorHex ? (
                          <>
                            {tr("كيبان للزبون:", "Customers see:")} <b className="text-ink">{colorName(v.colorHex)[lang]}</b>
                            <button type="button" className="cursor-pointer text-warm-600 underline hover:text-ink" onClick={() => setVariant(i, { colorHex: "" })}>
                              {tr("بلا لون", "No colour")}
                            </button>
                          </>
                        ) : v.colorAr ? (
                          tr(`الاسم القديم: ${v.colorAr}. اختر دائرة باش يتبدل.`, `Old name: ${v.colorEn || v.colorAr}. Pick a swatch to replace it.`)
                        ) : (
                          tr("بلا لون", "No colour")
                        )}
                      </span>
                    </fieldset>
                    <label className={labelCls}>
                      {tr("الكمية", "Quantity")}
                      <input className={input} type="number" min={0} inputMode="numeric" value={String(v.stock)} onChange={(e) => setVariant(i, { stock: e.target.value })} />
                      {changed ? (
                        <span className={`text-xs font-semibold ${changed > 0 ? "text-success" : "text-danger"}`} dir="ltr">
                          {changed > 0 ? `+${changed}` : changed}
                        </span>
                      ) : null}
                    </label>
                    <label className={labelCls}>
                      {tr("تنبيه عند", "Alert at")}
                      <input className={input} type="number" min={0} inputMode="numeric" value={String(v.lowStockAt)} onChange={(e) => setVariant(i, { lowStockAt: e.target.value })} />
                    </label>
                    <label className={labelCls}>
                      SKU
                      <input className={input} dir="ltr" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} />
                    </label>
                    <label className={labelCls}>
                      {tr("سعر البيع", "Sale price")}
                      <input className={input} type="number" min={1} inputMode="numeric" value={String(v.price)} onChange={(e) => setVariant(i, { price: e.target.value })} />
                    </label>
                    <label className={labelCls}>
                      {tr("قبل التخفيض", "Before discount")}
                      <input className={input} type="number" min={0} inputMode="numeric" value={String(v.compareAtPrice ?? "")} onChange={(e) => setVariant(i, { compareAtPrice: e.target.value })} />
                    </label>
                    <label className={labelCls}>
                      {tr("سعر شراء خاص", "Own purchase price")}
                      <input
                        className={input}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder={p.costPrice !== "" ? tr(`${p.costPrice} (المنتج)`, `${p.costPrice} (product)`) : "—"}
                        value={String(v.costPrice ?? "")}
                        onChange={(e) => setVariant(i, { costPrice: e.target.value })}
                      />
                    </label>
                    <label className={labelCls}>
                      {tr("السعة (اختياري)", "Storage (optional)")}
                      <input className={input} dir="ltr" placeholder="128GB" value={v.storage ?? ""} onChange={(e) => setVariant(i, { storage: e.target.value })} />
                    </label>
                  </div>
                  {/* A real loss lowers the profit; a mistaken entry only cancels units that never existed. */}
                  {v.id && changed < 0 ? (
                    <fieldset className="mt-3 rounded-xl bg-warm-50 p-3 ring-1 ring-warm-200">
                      <legend className="sr-only">{tr("علاش نقص المخزون؟", "Why is the stock going down?")}</legend>
                      <p className="mb-2 text-sm font-semibold text-ink">{tr(`علاش نقصتي ${-changed} قطعة؟`, `Why remove ${-changed} units?`)}</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-warm-800">
                          <input type="radio" name={`stock-why-${i}`} checked={!v.stockMistake} onChange={() => setVariant(i, { stockMistake: false })} className="mt-1 size-4 accent-ink" />
                          <span>
                            {tr("تخسرات، تهرسات ولا ضاعت", "Lost, broken or gone")}
                            <span className="block text-xs text-warm-600">{tr("خسارة حقيقية: كتنقص من صافي الربح.", "A real loss: comes off the net profit.")}</span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-warm-800">
                          <input type="radio" name={`stock-why-${i}`} checked={!!v.stockMistake} onChange={() => setVariant(i, { stockMistake: true })} className="mt-1 size-4 accent-ink" />
                          <span>
                            {tr("غلطة فالإدخال، ماشي حقيقية", "Entered by mistake, never real")}
                            <span className="block text-xs text-warm-600">{tr("ماشي خسارة: كتلغي السلعة الغالطة من رأس المال.", "Not a loss: cancels the wrong stock from the capital.")}</span>
                          </span>
                        </label>
                      </div>
                    </fieldset>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-warm-600">
            {tr(
              "الكمية الكلية = مجموع كميات الألوان. منتج بدون ألوان: احتفظ بسطر واحد بلا لون. كل تغيير في الكمية يُسجَّل في سجل الحركات. الأسعار بالدرهم.",
              "Total quantity = the sum of the colours. A product without colours keeps one line with no colour. Every quantity change is logged in the stock history. Prices in MAD.",
            )}
          </p>
        </section>

        <section className="admin-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base">{tr("المواصفات التقنية", "Technical specs")}</h2>
            <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => set("specs", [...p.specs, { key: "", valueAr: "", valueEn: "", numericValue: "" }])}>
              <Plus className="size-4" aria-hidden="true" />
              {tr("مواصفة جديدة", "New spec")}
            </button>
          </div>
          {p.specs.length ? (
            <>
              {/* Column names once, above the rows (wide screens; phones read the placeholders). */}
              <div aria-hidden="true" className="mb-1.5 hidden gap-2 px-1 text-xs font-semibold text-warm-600 sm:grid sm:grid-cols-[12rem_1fr_1fr_7rem_2.5rem]">
                <span>{tr("المواصفة", "Spec")}</span>
                <span>{tr("القيمة بالعربية", "Value in Arabic")}</span>
                <span>{tr("القيمة بالإنجليزية", "Value in English")}</span>
                <span>{tr("رقم الفلتر", "Filter number")}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {p.specs.map((s, i) => {
                  const custom = customSpecs.has(i) || (s.key !== "" && !KNOWN_SPECS.has(s.key));
                  const filter = FILTER_SPECS.has(s.key);
                  return (
                    <li key={i} className="grid gap-2 rounded-xl border border-warm-200 bg-white p-2 sm:grid-cols-[12rem_1fr_1fr_7rem_2.5rem] sm:items-start sm:border-0 sm:bg-transparent sm:p-0">
                      <div className="flex flex-col gap-1.5">
                        <SpecPicker
                          value={s.key}
                          custom={custom}
                          onPick={(key) => {
                            setCustomSpecs((all) => new Set([...all].filter((j) => j !== i)));
                            setSpec(i, { key });
                          }}
                          onOther={() => {
                            setCustomSpecs((all) => new Set(all).add(i));
                            if (KNOWN_SPECS.has(s.key)) setSpec(i, { key: "" });
                          }}
                        />
                        {custom ? (
                          <input
                            className={input}
                            dir="ltr"
                            autoFocus
                            placeholder="weight"
                            value={s.key}
                            onChange={(e) => setSpec(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                            aria-label={tr("اسم المواصفة بالإنجليزية (حروف صغيرة)", "Spec name in English (lower case)")}
                          />
                        ) : null}
                      </div>
                      <input className={input} placeholder="8 جيجابايت" value={s.valueAr} onChange={(e) => setSpec(i, { valueAr: e.target.value })} aria-label={tr("القيمة بالعربية", "Value in Arabic")} />
                      <input className={input} dir="ltr" placeholder="8 GB" value={s.valueEn} onChange={(e) => setSpec(i, { valueEn: e.target.value })} aria-label={tr("القيمة بالإنجليزية", "Value in English")} />
                      {/* Only the filter keys use a number; for the rest the field steps back. */}
                      <input
                        className={`${input} ${filter ? "" : "opacity-50"}`}
                        type="number"
                        step="any"
                        placeholder={filter ? "8" : "—"}
                        value={String(s.numericValue ?? "")}
                        onChange={(e) => setSpec(i, { numericValue: e.target.value })}
                        aria-label={tr("قيمة رقمية للفلاتر", "Number for the filters")}
                      />
                      <button
                        type="button"
                        className={iconBtn}
                        onClick={() => {
                          set("specs", p.specs.filter((_, j) => j !== i));
                          // Rows after this one move up by one: so do their "other spec" marks.
                          setCustomSpecs((all) => new Set([...all].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
                        }}
                        aria-label={tr("حذف المواصفة", "Delete spec")}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-warm-300 p-4 text-center text-sm text-warm-600">{tr("ما كاين حتى مواصفة. زيد وحدة بالزر فوق.", "No specs yet. Add one with the button above.")}</p>
          )}
          <p className="mt-2 text-xs text-warm-600">{tr("الذاكرة والتخزين والشاشة والمعالج كيبانو كفلاتر فصفحات الأقسام: عمّر ليهم رقم الفلتر (8، 256، 6.1…).", "RAM, storage, screen and CPU show as filters on category pages: give them a filter number (8, 256, 6.1…).")}</p>
        </section>

        <div className="glass-light sticky bottom-24 z-10 flex flex-wrap items-center gap-3 rounded-2xl border p-3 lg:bottom-3">
          <button type="submit" disabled={pending} className={buttonClass({ size: "lg" })}>
            {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
            {tr("حفظ المنتج", "Save product")}
          </button>
          {!state.errors?.length ? <FormMessage state={state} /> : null}
        </div>
      </form>

      {initial.id ? (
        <section className="admin-card p-4 ring-1 ring-danger/60">
          <h2 className="text-base text-danger">{tr("حذف المنتج", "Delete product")}</h2>
          <p className="mt-1 text-sm text-warm-600">{tr("الطلبات السابقة تحتفظ بنسخة من الاسم والسعر. لإخفائه فقط، ألغِ خيار «ظاهر في المتجر».", "Past orders keep a copy of the name and price. To only hide it, untick “Visible in the shop”.")}</p>
          <div className="mt-3">
            <ActionForm action={deleteProduct} submitLabel={tr("حذف نهائياً", "Delete for good")} variant="outline" confirm={tr("حذف هذا المنتج نهائياً؟ لا يمكن التراجع.", "Delete this product for good? This cannot be undone.")}>
              <input type="hidden" name="id" value={initial.id} />
            </ActionForm>
          </div>
        </section>
      ) : null}
    </div>
  );
}
