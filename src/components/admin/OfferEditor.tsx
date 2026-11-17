"use client";

import { ImageUp, LoaderCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { aiOfferTitles } from "@/app/actions/admin-campaign-ai";
import { deleteOffer, saveOffer, setOfferPublished, type OfferState } from "@/app/actions/admin-offers";
import { buttonClass } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/forms";
import { OFFER_STYLE_LABEL, OFFER_STYLES, type OfferStyle } from "@/lib/offers";
import { AiButton } from "./AiButton";
import { useAdminTr } from "./AdminLang";
import { useConfirm } from "./ConfirmDialog";
import { FormMessage, inputClass, L, Panel } from "./ui";
import { uploadImage } from "@/lib/upload-client";

export type OfferProductOption = { id: string; name: string; images: string[]; hasPage: boolean };
export type OfferInitial = {
  id?: string;
  name: string;
  productId: string;
  style: OfferStyle;
  titleAr: string;
  titleEn: string;
  sublineAr: string;
  sublineEn: string;
  image: string;
  link: "product" | "page";
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  isPublished: boolean;
};

/**
 * One home offer: which product, which look, the texts, the photo (one of the product's own, or a campaign photo
 * uploaded to the shop's Cloudinary), where the button goes and the dates. Price and stock are not here on purpose:
 * the banner takes them from the product.
 */
export function OfferEditor({ initial, products }: { initial: OfferInitial; products: OfferProductOption[] }) {
  const { tr, lang } = useAdminTr();
  const router = useRouter();
  const [state, action, pending] = useActionState<OfferState, FormData>(saveOffer, {});
  const [productId, setProductId] = useState(initial.productId);
  const [image, setImage] = useState(initial.image);
  const [titleAr, setTitleAr] = useState(initial.titleAr);
  const [titleEn, setTitleEn] = useState(initial.titleEn);
  const [sublineAr, setSublineAr] = useState(initial.sublineAr);
  const [sublineEn, setSublineEn] = useState(initial.sublineEn);
  const [ideas, setIdeas] = useState<{ titleAr: string; titleEn: string; sublineAr: string; sublineEn: string }[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [published, setPublished] = useState(initial.isPublished);
  const [actionMsg, setActionMsg] = useState<OfferState>({});
  const [busy, start] = useTransition();
  const [ask, dialog] = useConfirm();
  const product = products.find((p) => p.id === productId);

  // A new offer gets its own address once saved, so publishing and the AI helper can follow.
  useEffect(() => {
    if (state.ok && state.id && !initial.id) router.replace(`/admin/campaigns/${state.id}`);
  }, [state, initial.id, router]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadImage(file);
      setImage(url);
    } catch {
      setUploadError(tr("فشل رفع الصورة. جرب مرة أخرى.", "Upload failed. Try again."));
    } finally {
      setUploading(false);
    }
  }

  const shown = image || product?.images[0] || "";

  return (
    <>
      <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="grid max-w-4xl gap-6">
        {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="image" value={image} />

        <Panel title={tr("العرض", "The offer")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label={tr("سمية العرض (كتبان غير فاللوحة)", "Offer name (admin only)")}>
              <input name="name" defaultValue={initial.name} required maxLength={80} className={inputClass} />
            </L>
            <L label={tr("المنتج", "Product")}>
              <select name="productId" value={productId} onChange={(e) => (setProductId(e.target.value), setImage(""))} required className={inputClass}>
                <option value="">{tr("اختار منتج…", "Pick a product…")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </L>
          </div>
        </Panel>

        <Panel title={tr("الشكل", "Look")}>
          <div className="grid gap-3 sm:grid-cols-3">
            {OFFER_STYLES.map((s) => (
              <label key={s} className="flex cursor-pointer gap-3 rounded-xl border border-warm-200 p-3 has-checked:border-ink has-checked:bg-yellow-50">
                <input type="radio" name="style" value={s} defaultChecked={initial.style === s} className="mt-1 size-4" />
                <span>
                  <b className="block text-ink">{OFFER_STYLE_LABEL[s][lang]}</b>
                  <span className="text-sm text-warm-600">{lang === "en" ? OFFER_STYLE_LABEL[s].hintEn : OFFER_STYLE_LABEL[s].hintAr}</span>
                </span>
              </label>
            ))}
          </div>
        </Panel>

        <Panel title={tr("النصوص", "Texts")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label={tr("العنوان بالعربية", "Title in Arabic")}>
              <input name="titleAr" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} required maxLength={80} className={inputClass} />
            </L>
            <L label={tr("العنوان بالإنجليزية (اختياري)", "Title in English (optional)")}>
              <input name="titleEn" dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={80} className={inputClass} />
            </L>
            <L label={tr("الجملة تحت العنوان بالعربية", "Line under the title in Arabic")}>
              <input name="sublineAr" value={sublineAr} onChange={(e) => setSublineAr(e.target.value)} maxLength={160} className={inputClass} />
            </L>
            <L label={tr("الجملة تحت العنوان بالإنجليزية", "Line under the title in English")}>
              <input name="sublineEn" dir="ltr" value={sublineEn} onChange={(e) => setSublineEn(e.target.value)} maxLength={160} className={inputClass} />
            </L>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <AiButton
              pending={aiPending}
              className="self-start"
              onClick={() => {
                if (!productId) return setAiError(tr("اختار المنتج أولاً.", "Pick the product first."));
                setAiError(null);
                startAi(async () => {
                  const r = await aiOfferTitles(productId, titleAr);
                  if (r.ok) setIdeas(r.options);
                  else setAiError(r.message);
                });
              }}
            >
              {tr("اقترح عنوان بالذكاء الاصطناعي", "Suggest a title with AI")}
            </AiButton>
            {aiError ? <p role="alert" className="text-sm text-danger">{aiError}</p> : null}
            {ideas.length ? (
              <ul className="grid gap-2 sm:grid-cols-3">
                {ideas.map((o) => (
                  <li key={o.titleAr} className="flex flex-col gap-1 rounded-xl border border-warm-200 bg-warm-50 p-3">
                    <b className="text-ink">{o.titleAr}</b>
                    <span className="text-sm text-warm-600">{o.sublineAr}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTitleAr(o.titleAr);
                        setTitleEn(o.titleEn);
                        setSublineAr(o.sublineAr);
                        setSublineEn(o.sublineEn);
                      }}
                      className={buttonClass({ variant: "outline", className: "mt-1 self-start" })}
                    >
                      {tr("استعمل هادا", "Use this")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-warm-600">{tr("الثمن، الثمن القديم والستوك كيتاخدو من المنتج نيت. ما تكتبش الثمن فالعنوان.", "Price, old price and stock come straight from the product. Do not put the price in the title.")}</p>
        </Panel>

        <Panel title={tr("الصورة", "Photo")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="relative size-40 shrink-0 overflow-hidden rounded-xl bg-warm-100">
              {shown ? <Image src={shown} alt="" fill sizes="160px" unoptimized={shown.endsWith(".svg")} className="object-contain p-2" /> : null}
            </div>
            <div className="flex flex-col gap-2">
              {product?.images.length ? (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr("صور المنتج", "Product photos")}>
                  {product.images.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      role="radio"
                      aria-checked={(image || product.images[0]) === url}
                      aria-label={tr(`صورة المنتج ${i + 1}`, `Product photo ${i + 1}`)}
                      onClick={() => setImage(i === 0 ? "" : url)}
                      className="relative size-14 overflow-hidden rounded-lg border-2 border-warm-200 bg-white aria-checked:border-ink"
                    >
                      <Image src={url} alt="" fill sizes="56px" unoptimized={url.endsWith(".svg")} className="object-contain p-1" />
                    </button>
                  ))}
                </div>
              ) : null}
              <label className={buttonClass({ variant: "outline", className: "cursor-pointer self-start" })}>
                {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImageUp className="size-4" aria-hidden="true" />}
                {tr("رفع صورة خاصة بالحملة", "Upload a campaign photo")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {uploadError ? <p className="text-sm text-danger">{uploadError}</p> : null}
              <p className="text-xs text-warm-600">{tr("غير الصور ديالك. ممنوع صور ولا لوغوهات ماركات أخرى.", "Your own photos only. No other brands' pictures or logos.")}</p>
            </div>
          </div>
        </Panel>

        <Panel title={tr("الزر والتواريخ", "Button and dates")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label={tr("«تسوّق الآن» كيدي لـ", "“Shop now” goes to")}>
              <select name="link" defaultValue={initial.link} className={inputClass}>
                <option value="product">{tr("صفحة المنتج", "The product page")}</option>
                <option value="page" disabled={!product?.hasPage}>
                  {tr("صفحة العرض ديالو", "Its offer page")}
                  {product && !product.hasPage ? tr(" (ما منشوراش)", " (not published)") : ""}
                </option>
              </select>
            </L>
            <L label={tr("الترتيب (الصغير هو الأول)", "Order (smallest first)")}>
              <input name="sortOrder" type="number" min={0} max={1000} defaultValue={initial.sortOrder} className={inputClass} />
            </L>
            <L label={tr("كيبدا (اختياري)", "Starts (optional)")}>
              <input name="startsAt" type="datetime-local" dir="ltr" defaultValue={initial.startsAt} className={inputClass} />
            </L>
            <L label={tr("كيسالي (اختياري، كيبان للزبون)", "Ends (optional, shown to shoppers)")}>
              <input name="endsAt" type="datetime-local" dir="ltr" defaultValue={initial.endsAt} className={inputClass} />
            </L>
          </div>
          <p className="mt-3 text-xs text-warm-600">{tr("ملي كيفوت تاريخ النهاية، العرض كيختفي من الرئيسية بوحدو.", "Once the end date passes, the offer leaves the home page on its own.")}</p>
        </Panel>

        <div className="admin-card sticky bottom-3 z-10 flex flex-wrap items-center gap-3 p-4">
          <button type="submit" disabled={pending} className={buttonClass()}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {tr("حفظ", "Save")}
          </button>
          {initial.id ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    const r = await setOfferPublished(initial.id!, !published);
                    setActionMsg(r);
                    if (r.ok) setPublished(!published);
                  })
                }
                className={buttonClass({ variant: published ? "outline" : "dark" })}
              >
                {published ? tr("رجّعو مسودة", "Back to draft") : tr("نشر", "Publish")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  ask({ title: tr("نحذف هاد العرض؟ الأرقام ديالو كيبقاو.", "Delete this offer? Its figures stay."), yes: tr("حذف", "Delete") }).then((ok) => {
                    if (ok)
                      start(async () => {
                        await deleteOffer(initial.id!);
                        router.replace("/admin/campaigns");
                      });
                  })
                }
                className={buttonClass({ variant: "ghost", className: "text-danger" })}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {tr("حذف", "Delete")}
              </button>
            </>
          ) : null}
          <FormMessage state={actionMsg.message ? actionMsg : state} />
        </div>
      </form>
      {dialog}
    </>
  );
}
