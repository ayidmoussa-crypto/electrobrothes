"use client";

import { ExternalLink, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { findExternalRatings, rejectExternalRating, saveExternalRating, type ReviewActionState } from "@/app/actions/admin-reviews";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { formatCount, formatRating } from "@/lib/reviews/rules";
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

const STATUS = { PENDING: { text: "كيتسنى تأكيدك", tone: "warning" }, APPROVED: { text: "منشور", tone: "success" }, REJECTED: { text: "مرفوض", tone: "neutral" } } as const;

/** One form for adding, checking and updating: publishing always needs the box ticked. */
function RatingForm({ productId, row, onDone }: { productId: string; row?: ExternalRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(async (prev, fd) => {
    const result = await saveExternalRating(prev, fd);
    if (result.ok) onDone?.();
    return result;
  }, {});
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="productId" value={productId} />
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <L label="الموقع">
        <input name="source" required maxLength={60} defaultValue={row?.source} dir="auto" placeholder="Amazon" className={inputClass} />
      </L>
      <L label="الرابط المباشر لنفس الموديل">
        <input name="url" type="url" required maxLength={1000} defaultValue={row?.url} dir="ltr" placeholder="https://" className={inputClass} />
      </L>
      <div className="grid grid-cols-3 gap-2 sm:col-span-2">
        <L label="النقطة">
          <input name="rating" type="number" step="0.1" min={0} max={100} required defaultValue={row?.rating} dir="ltr" className={inputClass} />
        </L>
        <L label="من">
          <select name="ratingMax" defaultValue={row?.ratingMax ?? 5} className={inputClass}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={100}>100</option>
          </select>
        </L>
        <L label="عدد التقييمات">
          <input name="ratingCount" type="number" min={0} defaultValue={row?.ratingCount ?? ""} dir="ltr" className={inputClass} />
        </L>
      </div>
      <L label="ملخص لآراء المراجعين بالعربية (بكلماتنا، اختياري)">
        <input name="summaryAr" maxLength={300} defaultValue={row?.summaryAr ?? ""} className={inputClass} />
      </L>
      <L label="ملخص بالإنجليزية (اختياري)">
        <input name="summaryEn" maxLength={300} defaultValue={row?.summaryEn ?? ""} dir="ltr" className={inputClass} />
      </L>
      <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-ink sm:col-span-2">
        <input type="checkbox" name="confirmed" required className="mt-1 size-4" />
        حليت الرابط، وهو نفس الموديل بالضبط، والنقطة والعدد صحاح
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass({ className: "!min-h-10 !px-4 !text-sm" })}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {row?.status === "APPROVED" ? "حفظ وتحديث التاريخ" : "قبول ونشر"}
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
        <span className="text-xs text-warm-600">{row.ratingCount === null ? "العدد غير مذكور" : `${formatCount(row.ratingCount)} تقييم`}</span>
        <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].text}</Badge>
        {row.suggestedByAi && row.status === "PENDING" ? <span className="text-xs text-warm-600">من اقتراح المساعد</span> : null}
        <span className="text-xs text-warm-600">آخر تحديث: {row.lastChecked}</span>
      </div>
      <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 flex min-h-8 items-center gap-1 text-xs text-warm-800 underline underline-offset-2" dir="ltr">
        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{row.url}</span>
      </a>
      {row.stale && row.status === "APPROVED" ? (
        <p role="alert" className="mt-1 flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs font-semibold text-warning-text">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          فات 3 شهور على آخر تحديث: حل الرابط وحدّث النقطة.
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={buttonClass({ variant: "outline", className: "!min-h-9 !px-3 !text-xs" })}>
          {row.status === "APPROVED" ? "تحديث" : "راجع وقبل"}
        </button>
        {row.status !== "REJECTED" ? (
          <button type="button" disabled={pending} onClick={reject} className={buttonClass({ variant: "ghost", className: "!min-h-9 !px-3 !text-xs" })}>
            {row.status === "APPROVED" ? "حيد من المتجر" : "رفض"}
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
  const search = () =>
    start(async () => {
      setState({});
      try {
        setState(await findExternalRatings(productId));
        router.refresh();
      } catch {
        setState({ ok: false, message: "ما قدرناش نوصلو للسيرفر. عاود جرب." });
      }
    });
  const stale = rows.filter((r) => r.stale && r.status === "APPROVED").length;

  return (
    <Panel title="تقييمات خارجية">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={search} disabled={searching} className={buttonClass({ className: "!min-h-10 !px-3 !text-sm" })}>
          {searching ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}✨ قلب على التقييمات
        </button>
        <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding} className={buttonClass({ variant: "outline", className: "!min-h-10 !px-3 !text-sm" })}>
          زيد مصدر بيدك
        </button>
        {searching ? <span className="text-xs text-warm-600" role="status">البحث كياخد دقيقة ولا جوج...</span> : null}
      </div>
      <p className="mt-2 text-xs text-warm-600">ما كيتنشر والو بلا تأكيدك. هاد التقييمات ما كتدخلش فبيانات Google، وما كننسخوش نصوص المراجعين.</p>
      {state.message ? (
        <div className="mt-2">
          <FormMessage state={state} />
        </div>
      ) : null}
      {stale ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-text">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {stale} مصدر فات عليه 3 شهور بلا تحديث.
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
