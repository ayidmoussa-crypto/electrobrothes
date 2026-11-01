"use client";

import { Check, ChevronDown, CircleAlert, LoaderCircle, RotateCcw, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { acceptAllSeoSuggestions, acceptSeoSuggestion, generateSeoSuggestions, rejectSeoSuggestion, undoSeoSuggestion, type SeoActionState } from "@/app/actions/admin-seo";
import { buttonClass } from "@/components/ui/button";
import type { ProductChanges, SuggestionView } from "@/lib/seo-content/service";
import { FormMessage } from "./ui";

const iconButton = "grid size-10 shrink-0 cursor-pointer place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:size-8";

function FullValue({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-xs font-semibold text-warm-600">{title}</p>
      <div className="space-y-1 break-words text-sm text-warm-800">
        {lines.map((line, i) => (
          <p key={i} dir="auto">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/** One change on one line; a click opens the full text, and the old value when there was one. */
function ChangeRow({ row }: { row: SuggestionView }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const act = async (action: (id: string) => Promise<SeoActionState>) => {
    setBusy(true);
    setError("");
    try {
      const result = await action(row.id);
      if (result.ok) router.refresh();
      else setError(result.message ?? "وقع مشكل.");
    } catch {
      setError("ما قدرناش نوصلو للسيرفر. عاود جرب.");
    } finally {
      setBusy(false);
    }
  };

  const waiting = row.status === "PENDING";
  return (
    <li className={`border-b border-warm-200 last:border-0 ${waiting && row.approval ? "bg-warning-soft" : ""}`}>
      <div className="flex items-center gap-1 pe-1">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 ps-2 text-start md:min-h-9">
          <ChevronDown className={`size-3.5 shrink-0 text-warm-600 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          <span className={`w-28 shrink-0 truncate text-xs font-semibold md:w-44 ${waiting && row.approval ? "text-warning-text" : "text-warm-800"}`} title={row.label}>
            {row.label}
          </span>
          {row.oldLines.length === 0 ? <span className="shrink-0 rounded bg-yellow-100 px-1.5 text-xs font-semibold text-yellow-900">جديد</span> : null}
          {/* bdi: Latin values keep their reading order but stay in the same column as Arabic ones. */}
          <span className="min-w-0 flex-1 truncate text-sm text-warm-800">
            <bdi>{row.preview}</bdi>
          </span>
        </button>
        {busy ? <LoaderCircle className="size-4 shrink-0 animate-spin text-warm-600" aria-hidden="true" /> : null}
        {waiting ? (
          <>
            {!row.needsCheck ? (
              <button type="button" disabled={busy} onClick={() => act(acceptSeoSuggestion)} aria-label={`قبول: ${row.label}`} title="قبول" className={`${iconButton} bg-yellow-500 text-ink hover:bg-yellow-600 active:bg-yellow-700`}>
                <Check className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => act(rejectSeoSuggestion)} aria-label={`رفض: ${row.label}`} title="رفض" className={`${iconButton} text-warm-800 hover:bg-warm-200`}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => act(undoSeoSuggestion)} aria-label={`تراجع: ${row.label}`} title="تراجع" className={`${iconButton} text-warm-800 hover:bg-warm-200`}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {open ? (
        <div className={`grid gap-3 border-t border-warm-200 bg-white p-3 ${row.oldLines.length ? "md:grid-cols-2" : ""}`}>
          {row.oldLines.length ? <FullValue title="القديم" lines={row.oldLines} /> : null}
          <FullValue title={waiting ? "الجديد" : "المطبق"} lines={row.newLines} />
          {row.needsCheck ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-text md:col-span-2">
              <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              Claude ما متأكدش من هاد المواصفة. زيدها يدوياً من صفحة المنتج ملي تتأكد.
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** A closed line that opens: the automatic changes, or anything else kept out of the way. */
function CollapsedGroup({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-warm-200 bg-warm-50">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-10 w-full cursor-pointer items-center gap-2 px-2 text-sm font-semibold text-warm-800 md:min-h-9">
        <ChevronDown className={`size-3.5 shrink-0 text-warm-600 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        {label}
      </button>
      {open ? children : null}
    </div>
  );
}

export function AppliedList({ rows }: { rows: SuggestionView[] }) {
  return (
    <ul className="border-t border-warm-200 bg-white">
      {rows.map((row) => (
        <ChangeRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

/** What a product has: orange rows first, the others, then one line for what already went live. */
export function ChangesTable({ product }: { product: Pick<ProductChanges, "pending" | "auto"> }) {
  return (
    <>
      {product.pending.length ? (
        <ul>
          {product.pending.map((row) => (
            <ChangeRow key={row.id} row={row} />
          ))}
        </ul>
      ) : null}
      {product.auto.length ? (
        <CollapsedGroup label={`تطبقو تلقائياً (${product.auto.length})`}>
          <AppliedList rows={product.auto} />
        </CollapsedGroup>
      ) : null}
    </>
  );
}

export function ProductAccordion({ product, defaultOpen = false }: { product: ProductChanges; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, setState] = useState<SeoActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  const acceptable = product.pending.filter((r) => !r.needsCheck).length;
  const approvals = product.pending.filter((r) => r.approval).length;
  const acceptAll = () =>
    start(async () => {
      setState({});
      try {
        const result = await acceptAllSeoSuggestions(product.productId);
        setState(result.ok ? {} : result);
        router.refresh();
      } catch {
        setState({ ok: false, message: "ما قدرناش نوصلو للسيرفر. عاود جرب." });
      }
    });

  return (
    <section className="admin-card overflow-hidden">
      <div className="flex items-center gap-2 pe-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 ps-2 text-start">
          <ChevronDown className={`size-4 shrink-0 text-warm-600 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-warm-100">
            {product.image ? <Image src={product.image} alt="" fill sizes="36px" unoptimized className="object-contain p-0.5" /> : null}
          </span>
          {/* Phones: the count goes under the name, so the name keeps the width. */}
          <span className="flex min-w-0 flex-1 flex-col gap-x-2 md:flex-row md:items-center">
            <span className="min-w-0 truncate text-sm font-bold text-ink">{product.name}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-warm-600">
              {product.pending.length + product.auto.length} تعديل
              {approvals ? <span className="rounded-full bg-warning-soft px-2 py-0.5 font-bold text-warning-text">{approvals} موافقة</span> : null}
            </span>
          </span>
        </button>
        {acceptable ? (
          <button type="button" disabled={pending} onClick={acceptAll} className={`${buttonClass({ className: "!min-h-9 shrink-0 !px-3 !text-sm" })} ms-auto`}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            قبول الكل
          </button>
        ) : null}
      </div>
      {state.message ? (
        <div className="px-2 pb-2">
          <FormMessage state={state} />
        </div>
      ) : null}
      {open ? (
        <div className="border-t border-warm-200 bg-white">
          <ChangesTable product={product} />
        </div>
      ) : null}
    </section>
  );
}

export function CollapsedApplied({ label, rows }: { label: string; rows: SuggestionView[] }) {
  return (
    <section className="admin-card overflow-hidden">
      <CollapsedGroup label={label}>
        <AppliedList rows={rows} />
      </CollapsedGroup>
    </section>
  );
}

/** The product page's panel: score, what is missing, the generate button, and this product's changes. */
export function SeoPanel({ productId, score, missing, changes }: { productId: string; score: number; missing: { label: string; points: number }[]; changes: Pick<ProductChanges, "pending" | "auto"> | null }) {
  const [state, setState] = useState<SeoActionState>({});
  const [pending, start] = useTransition();
  const [showMissing, setShowMissing] = useState(false);
  const router = useRouter();

  const generate = () =>
    start(async () => {
      setState({});
      try {
        setState(await generateSeoSuggestions(productId));
        router.refresh();
      } catch {
        setState({ ok: false, message: "ما قدرناش نوصلو للسيرفر. عاود جرب." });
      }
    });

  return (
    <section className="admin-card overflow-hidden" aria-label="السيو والمحتوى">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <button type="button" onClick={() => setShowMissing((s) => !s)} aria-expanded={showMissing} disabled={!missing.length} className="flex cursor-pointer items-center gap-2 text-start disabled:cursor-default">
          <ScoreBadge score={score} />
          <span className="text-sm font-bold text-ink">نقطة السيو</span>
          <span className="text-xs text-warm-600">{missing.length ? `${missing.length} حاجة ناقصة` : "كلشي كامل"}</span>
          {missing.length ? <ChevronDown className={`size-3.5 text-warm-600 transition-transform ${showMissing ? "rotate-180" : ""}`} aria-hidden="true" /> : null}
        </button>
        <button type="button" onClick={generate} disabled={pending} className={buttonClass({ className: "!min-h-10 !px-3 !text-sm" })}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
          ✨ توليد بالذكاء الاصطناعي
        </button>
      </div>
      {state.message ? (
        <div className="px-3 pb-3">
          <FormMessage state={state} />
        </div>
      ) : null}
      {showMissing && missing.length ? (
        <ul className="grid gap-x-4 border-t border-warm-200 px-3 py-2 text-sm text-warm-800 md:grid-cols-2">
          {missing.map((m) => (
            <li key={m.label} className="flex items-start justify-between gap-2 py-0.5">
              <span>{m.label}</span>
              <span className="shrink-0 text-xs font-semibold text-warm-600" dir="ltr">
                +{m.points}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {changes ? (
        <div className="border-t border-warm-200 bg-white">
          <ChangesTable product={changes} />
          <p className="border-t border-warm-200 bg-warm-50 px-3 py-1.5 text-xs text-warm-600">كل قبول ولا تراجع كيحدّث هاد الصفحة: احفظ تعديلاتك ديال المنتج قبل.</p>
        </div>
      ) : null}
    </section>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-success-soft text-success" : score >= 60 ? "bg-yellow-100 text-yellow-900" : "bg-danger-soft text-danger";
  return (
    <span className={`inline-grid min-w-10 place-items-center rounded-full px-2 py-0.5 text-sm font-extrabold ${tone}`} title={`${score} من 100`}>
      {score}
    </span>
  );
}
