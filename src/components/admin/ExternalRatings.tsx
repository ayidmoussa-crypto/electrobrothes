"use client";

import { Select } from "@/components/ui/Select";
import { ExternalLink, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { findExternalRatings, rejectExternalRating, saveExternalRating, type ReviewActionState } from "@/app/actions/admin-reviews";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/forms";
import { formatCount, formatRating } from "@/lib/reviews/rules";
import { useAdminTr } from "./AdminLang";
import { FormMessage, inputClass, L, Panel } from "./ui";

export type ExternalRow = {
  id: string;
  source: string;
  url: string;
  rating: number;
  ratingMax: number;
  ratingCount: number | null;
  summaryAr: string | null;
  summaryEn: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  lastChecked: string;
  stale: boolean;
  suggestedByAi: boolean;
};

const STATUS = {
  PENDING: { text: ["كيتسنى تأكيدك", "Awaiting your check"], tone: "warning" },
  APPROVED: { text: ["منشور", "Published"], tone: "success" },
  REJECTED: { text: ["مرفوض", "Rejected"], tone: "neutral" },
} as const;

/** One form for adding, checking and updating: publishing always needs the box ticked. */
function RatingForm({ productId, row, onDone }: { productId: string; row?: ExternalRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(async (prev, fd) => {
    const result = await saveExternalRating(prev, fd);
    if (result.ok) onDone?.();
    return result;
  }, {});
  const { tr } = useAdminTr();
  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="productId" value={productId} />
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <L label={tr("الموقع", "Site")}>
        <input name="source" required maxLength={60} defaultValue={row?.source} dir="auto" placeholder="Amazon" className={inputClass} />
      </L>
      <L label={tr("الرابط المباشر لنفس الموديل", "Direct link to the same model")}>
        <input name="url" type="url" required maxLength={1000} defaultValue={row?.url} dir="ltr" placeholder="https://" className={inputClass} />
      </L>
      <div className="grid grid-cols-3 gap-2 sm:col-span-2">
        <L label={tr("النقطة", "Rating")}>
          <input name="rating" type="number" step="0.1" min={0} max={100} required defaultValue={row?.rating} dir="ltr" className={inputClass} />
        </L>
        <L label={tr("من", "Out of")}>
          <Select name="ratingMax" defaultValue={row?.ratingMax ?? 5} className={inputClass}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={100}>100</option>
          </Select>
        </L>
        <L label={tr("عدد التقييمات", "Number of ratings")}>
          <input name="ratingCount" type="number" min={0} defaultValue={row?.ratingCount ?? ""} dir="ltr" className={inputClass} />
        </L>
      </div>
      <L label={tr("ملخص لآراء المراجعين بالعربية (بكلماتنا، اختياري)", "Summary of reviewers' views in Arabic (our words, optional)")}>
        <input name="summaryAr" maxLength={300} defaultValue={row?.summaryAr ?? ""} className={inputClass} />
      </L>
      <L label={tr("ملخص بالإنجليزية (اختياري)", "Summary in English (optional)")}>
        <input name="summaryEn" maxLength={300} defaultValue={row?.summaryEn ?? ""} dir="ltr" className={inputClass} />
      </L>
      <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-ink sm:col-span-2">
        <input type="checkbox" name="confirmed" required className="mt-1 size-4" />
        {tr("حليت الرابط، وهو نفس الموديل بالضبط، والنقطة والعدد صحاح", "I opened the link: it is exactly the same model, and the rating and count are right")}
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass({ className: "!min-h-10 !px-4 !text-sm" })}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {row?.status === "APPROVED" ? tr("حفظ وتحديث التاريخ", "Save and update the date") : tr("قبول ونشر", "Accept and publish")}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function RatingRow({ row, productId }: { row: ExternalRow; productId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ReviewActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const { tr } = useAdminTr();
  const reject = () =>
    start(async () => {
      const result = await rejectExternalRating(row.id);
      setState(result.ok ? {} : result);
      router.refresh();
    });
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="font-bold text-ink">{row.source}</span>
        <span className="font-extrabold text-ink" dir="ltr">
          ⭐ {formatRating(row.rating, row.ratingMax)}
        </span>
        <span className="text-xs text-warm-600">{row.ratingCount === null ? tr("العدد غير مذكور", "Count not given") : tr(`${formatCount(row.ratingCount)} تقييم`, `${formatCount(row.ratingCount)} ratings`)}</span>
        <Badge tone={STATUS[row.status].tone}>{tr(STATUS[row.status].text[0], STATUS[row.status].text[1])}</Badge>
        {row.suggestedByAi && row.status === "PENDING" ? <span className="text-xs text-warm-600">{tr("من اقتراح المساعد", "Suggested by the assistant")}</span> : null}
        <span className="text-xs text-warm-600">{tr("آخر تحديث:", "Last updated:")} {row.lastChecked}</span>
      </div>
      <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 flex min-h-8 items-center gap-1 text-xs text-warm-800 underline underline-offset-2" dir="ltr">
        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{row.url}</span>
      </a>
      {row.stale && row.status === "APPROVED" ? (
        <p role="alert" className="mt-1 flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs font-semibold text-warning-text">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {tr("فات 3 شهور على آخر تحديث: حل الرابط وحدّث النقطة.", "3 months since the last update: open the link and update the rating.")}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={buttonClass({ variant: "outline", className: "!min-h-9 !px-3 !text-xs" })}>
          {row.status === "APPROVED" ? tr("تحديث", "Update") : tr("راجع وقبل", "Review and accept")}
        </button>
        {row.status !== "REJECTED" ? (
          <button type="button" disabled={pending} onClick={reject} className={buttonClass({ variant: "ghost", className: "!min-h-9 !px-3 !text-xs" })}>
            {row.status === "APPROVED" ? tr("حيد من المتجر", "Remove from shop") : tr("رفض", "Reject")}
          </button>
        ) : null}
        <FormMessage state={state} />
      </div>
      {open ? (
        <div className="mt-2 rounded-lg bg-white/60 p-3">
          <RatingForm productId={productId} row={row} onDone={() => { setOpen(false); router.refresh(); }} />
        </div>
      ) : null}
    </li>
  );
}

export function ExternalRatings({ productId, rows }: { productId: string; rows: ExternalRow[] }) {
  const [state, setState] = useState<ReviewActionState>({});
  const [searching, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const { tr } = useAdminTr();
  const search = () =>
    start(async () => {
      setState({});
      try {
        setState(await findExternalRatings(productId));
        router.refresh();
      } catch {
        setState({ ok: false, message: tr("ما قدرناش نوصلو للسيرفر. عاود جرب.", "Could not reach the server. Try again.") });
      }
    });
  const stale = rows.filter((r) => r.stale && r.status === "APPROVED").length;

  return (
    <Panel title={tr("تقييمات خارجية", "External ratings")}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={search} disabled={searching} className={buttonClass({ className: "!min-h-10 !px-3 !text-sm" })}>
          {searching ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}{tr("قلب على التقييمات", "Search for ratings")}
        </button>
        <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding} className={buttonClass({ variant: "outline", className: "!min-h-10 !px-3 !text-sm" })}>
          {tr("زيد مصدر بيدك", "Add a source by hand")}
        </button>
        {searching ? <span className="text-xs text-warm-600" role="status">{tr("البحث كياخد دقيقة ولا جوج…", "The search takes a minute or two…")}</span> : null}
      </div>
      <p className="mt-2 text-xs text-warm-600">{tr("ما كيتنشر والو بلا تأكيدك. هاد التقييمات ما كتدخلش فبيانات Google، وما كننسخوش نصوص المراجعين.", "Nothing is published without your check. These ratings stay out of Google data, and reviewers' texts are never copied.")}</p>
      {state.message ? (
        <div className="mt-2">
          <FormMessage state={state} />
        </div>
      ) : null}
      {stale ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-text">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {tr(`${stale} مصدر فات عليه 3 شهور بلا تحديث.`, `${stale} sources not updated for 3 months.`)}
        </p>
      ) : null}
      {adding ? (
        <div className="mt-3 rounded-lg bg-white/60 p-3">
          <RatingForm productId={productId} onDone={() => { setAdding(false); router.refresh(); }} />
        </div>
      ) : null}
      {rows.length ? (
        <ul className="mt-2 divide-y divide-warm-200">
          {rows.map((row) => (
            <RatingRow key={row.id} row={row} productId={productId} />
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
