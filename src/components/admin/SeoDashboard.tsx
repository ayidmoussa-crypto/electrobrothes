"use client";

import { Check, Circle, CircleAlert, ExternalLink, LoaderCircle, Monitor, Smartphone, Sparkles, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { generateSeoSuggestions, loadSeoDetail, runSiteChecks, saveSeoKeywords, type SeoActionState } from "@/app/actions/admin-seo";
import { buttonClass } from "@/components/ui/button";
import { cutText, scoreTone, type CheckStatus, type SeoCheck, type SeoLang } from "@/lib/seo-content/checks";
import type { SeoGridProduct, TechCheck } from "@/lib/seo-content/score";
import type { SeoDetail } from "@/lib/seo-content/service";
import { AcceptAllButton, ChangesTable, SeoChangedContext } from "./SeoSuggestions";
import { FormMessage, inputClass } from "./ui";

const RING = { red: "stroke-danger", orange: "stroke-warning", green: "stroke-success" };
const TEXT = { red: "text-danger", orange: "text-warning-text", green: "text-success" };

/** Follows the score as it changes, so an accepted suggestion is seen climbing. */
function useCountTo(target: number) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 600;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      current.current = Math.round(from + (target - from) * t);
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

export function ScoreRing({ score, size = 128, label }: { score: number; size?: number; label?: string }) {
  const shown = useCountTo(score);
  const tone = scoreTone(shown);
  const stroke = Math.max(6, size / 11);
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "النقطة"}: ${score} من 100`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-warm-200" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - shown / 100)} className={RING[tone]} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center leading-none">
        <span>
          <span className={`block font-extrabold ${TEXT[tone]}`} style={{ fontSize: size * 0.3 }}>
            {shown}
          </span>
          {size >= 96 ? <span className="mt-1 block text-xs text-warm-600">من 100</span> : null}
        </span>
      </span>
    </div>
  );
}

export function StatusDot({ status }: { status: CheckStatus }) {
  const look = {
    good: { Icon: Check, cls: "bg-success-soft text-success", label: "مزيان" },
    warn: { Icon: TriangleAlert, cls: "bg-warning-soft text-warning-text", label: "تحذير" },
    bad: { Icon: X, cls: "bg-danger-soft text-danger", label: "مشكل" },
  }[status];
  return (
    <span className={`grid size-5 shrink-0 place-items-center rounded-full ${look.cls}`} role="img" aria-label={look.label}>
      <look.Icon className="size-3" aria-hidden="true" />
    </span>
  );
}

export function CheckRows({ rows }: { rows: TechCheck[] }) {
  return (
    <>
      {rows.map((c) => (
        <li key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
          <StatusDot status={c.status} />
          <span className="shrink-0 font-semibold text-ink">{c.label}</span>
          <span className="min-w-0 truncate text-xs text-warm-600" title={c.detail}>
            {c.detail}
          </span>
        </li>
      ))}
    </>
  );
}

/** Reads the live pages after the page has opened, so opening it never waits for them. */
export function SiteCheckRows({ initial }: { initial?: TechCheck[] }) {
  const [rows, setRows] = useState<TechCheck[] | null>(initial ?? null);
  useEffect(() => {
    if (initial) return;
    runSiteChecks()
      .then(setRows)
      .catch(() => setRows([{ id: "site", label: "صفحات الموقع", status: "warn", detail: "ما قدرناش نفحصها دابا" }]));
  }, [initial]);
  if (rows) return <CheckRows rows={rows} />;
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm text-warm-600" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      كنفحصو sitemap وrobots.txt وschema وhreflang وOpen Graph...
    </li>
  );
}

/** Red to green, with a marker at the product's score. Runs right to left, like the page. */
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative h-2 rounded-full bg-linear-to-l from-danger via-warning to-success" aria-hidden="true">
      <span className="absolute top-1/2 h-4 w-1.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-white" style={{ insetInlineStart: `${score}%` }} />
    </div>
  );
}

function ProductCard({ product, onOpen }: { product: SeoGridProduct; onOpen: () => void }) {
  const tone = scoreTone(product.score);
  return (
    <button type="button" onClick={onOpen} className="admin-card flex min-w-0 cursor-pointer flex-col gap-2.5 p-3 text-start transition-transform hover:-translate-y-0.5">
      <span className="flex w-full items-center gap-2.5">
        <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-warm-100">
          {product.image ? <Image src={product.image} alt="" fill sizes="44px" unoptimized className="object-contain p-1" /> : null}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink" title={product.name}>
          {product.name}
        </span>
        <span className={`text-xl font-extrabold ${TEXT[tone]}`} aria-label={`النقطة ${product.score} من 100`}>
          {product.score}
        </span>
      </span>
      <ScoreBar score={product.score} />
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex gap-2.5 text-xs text-warm-600">
          <span>
            عربية <b className={TEXT[scoreTone(product.scoreAr)]}>{product.scoreAr}</b>
          </span>
          <span>
            إنجليزية <b className={TEXT[scoreTone(product.scoreEn)]}>{product.scoreEn}</b>
          </span>
        </span>
        {product.suggestions ? (
          <span className="rounded-lg bg-yellow-500 px-2.5 py-1 text-xs font-bold text-ink">الاقتراحات ({product.suggestions})</span>
        ) : tone === "green" ? (
          <span className="flex items-center gap-1 text-xs font-bold text-success">
            <Check className="size-3.5" aria-hidden="true" />
            ممتاز
          </span>
        ) : (
          <span className="text-xs font-semibold text-warm-600">{product.problems} مشاكل</span>
        )}
      </span>
    </button>
  );
}

function GooglePreview({ preview, device, lang }: { preview: SeoDetail["previews"]["ar"]; device: "desktop" | "mobile"; lang: SeoLang }) {
  const mobile = device === "mobile";
  const url = preview.url.replace(/^https?:\/\//, "");
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className={`rounded-xl border border-warm-200 bg-white p-3 ${mobile ? "mx-auto max-w-sm" : ""}`}>
      <p className="truncate text-xs text-warm-600" dir="ltr">
        {url}
      </p>
      <p className={`mt-1 font-semibold text-ink underline-offset-2 hover:underline ${mobile ? "text-base" : "text-lg"}`}>{cutText(preview.title, mobile ? 78 : 60)}</p>
      <p className="mt-1 text-sm leading-snug text-warm-800">{cutText(preview.description, mobile ? 120 : 155)}</p>
    </div>
  );
}

function WhatsAppPreview({ preview, lang }: { preview: SeoDetail["previews"]["ar"]; lang: SeoLang }) {
  const host = preview.url.replace(/^https?:\/\//, "").split("/")[0];
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-xs overflow-hidden rounded-xl border border-warm-200 bg-warm-100">
      <span className="relative block aspect-[1200/630] bg-warm-200">
        <Image src={preview.image} alt="" fill sizes="320px" unoptimized className="object-cover" />
      </span>
      <div className="p-2.5">
        <p className="truncate text-sm font-bold text-ink">{preview.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-warm-800">{preview.description}</p>
        <p className="mt-1 text-xs text-warm-600" dir="ltr">
          {host}
        </p>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; text: string; icon?: typeof Monitor }[]; onChange: (id: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-warm-100 p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${value === o.id ? "bg-ink text-white" : "text-warm-800 hover:bg-warm-200"}`}>
          {o.icon ? <o.icon className="size-3.5" aria-hidden="true" /> : null}
          {o.text}
        </button>
      ))}
    </div>
  );
}

const ORDER: Record<CheckStatus, number> = { bad: 0, warn: 1, good: 2 };

function ChecksList({ checks }: { checks: SeoCheck[] }) {
  return (
    <ul className="divide-y divide-warm-200 rounded-xl border border-warm-200 bg-white">
      {[...checks]
        .sort((a, b) => ORDER[a.status] - ORDER[b.status])
        .map((c) => (
          <li key={c.id} className="flex items-start gap-2 px-3 py-2">
            <StatusDot status={c.status} />
            <p className="min-w-0 text-sm">
              <span className="font-semibold text-ink">{c.label}: </span>
              <span className="text-warm-800">{c.hint}</span>
            </p>
          </li>
        ))}
    </ul>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SeoDrawerBody({ detail, reload }: { detail: SeoDetail; reload: () => void }) {
  const [lang, setLang] = useState<SeoLang>("ar");
  const [view, setView] = useState<"desktop" | "mobile" | "whatsapp">("desktop");
  const [ar, setAr] = useState(detail.focusKeywordAr);
  const [en, setEn] = useState(detail.focusKeywordEn);
  const [state, setState] = useState<SeoActionState>({});
  const [saving, startSave] = useTransition();
  const [generating, startGenerate] = useTransition();
  const router = useRouter();

  // A generated keyword replaces what is shown, unless the owner is in the middle of typing another.
  const [seen, setSeen] = useState({ ar: detail.focusKeywordAr, en: detail.focusKeywordEn });
  if (seen.ar !== detail.focusKeywordAr || seen.en !== detail.focusKeywordEn) {
    setSeen({ ar: detail.focusKeywordAr, en: detail.focusKeywordEn });
    setAr(detail.focusKeywordAr);
    setEn(detail.focusKeywordEn);
  }

  const run = (start: typeof startSave, task: () => Promise<SeoActionState>) =>
    start(async () => {
      setState({});
      try {
        setState(await task());
        router.refresh();
        reload();
      } catch {
        setState({ ok: false, message: "ما قدرناش نوصلو للسيرفر. عاود جرب." });
      }
    });
  const dirty = ar.trim() !== detail.focusKeywordAr || en.trim() !== detail.focusKeywordEn;
  const acceptable = detail.changes.pending.filter((r) => !r.needsCheck).length;
  const hasChanges = detail.changes.pending.length + detail.changes.auto.length + detail.changes.accepted.length > 0;

  return (
    <SeoChangedContext.Provider value={reload}>
      <div className="space-y-5">
        <Section title="الكلمة المفتاحية (Focus keyword)">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-warm-600">
              بالعربية
              <input value={ar} onChange={(e) => setAr(e.target.value)} maxLength={80} className={inputClass} placeholder="مثال: سماعة سوني WH-1000XM5" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-warm-600">
              بالإنجليزية
              <input value={en} onChange={(e) => setEn(e.target.value)} maxLength={80} dir="ltr" className={inputClass} placeholder="Sony WH-1000XM5" />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!dirty || saving} onClick={() => run(startSave, () => saveSeoKeywords(detail.id, ar, en))} className={buttonClass({ variant: "dark", className: "!min-h-9 !px-3 !text-sm" })}>
              {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              حفظ الكلمات
            </button>
            <button type="button" disabled={generating} onClick={() => run(startGenerate, () => generateSeoSuggestions(detail.id))} className={buttonClass({ className: "!min-h-9 !px-3 !text-sm" })}>
              {generating ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              توليد بالذكاء الاصطناعي
            </button>
          </div>
          {state.message ? (
            <div className="mt-2">
              <FormMessage state={state} />
            </div>
          ) : null}
        </Section>

        <div className="flex items-center justify-between gap-2">
          <Segmented
            label="لغة المعاينة والفحوصات"
            value={lang}
            onChange={setLang}
            options={[
              { id: "ar", text: `العربية ${detail.scoreAr}` },
              { id: "en", text: `English ${detail.scoreEn}` },
            ]}
          />
        </div>

        <Section
          title="المعاينة"
          aside={
            <Segmented
              label="نوع المعاينة"
              value={view}
              onChange={setView}
              options={[
                { id: "desktop", text: "حاسوب", icon: Monitor },
                { id: "mobile", text: "هاتف", icon: Smartphone },
                { id: "whatsapp", text: "واتساب" },
              ]}
            />
          }
        >
          {view === "whatsapp" ? <WhatsAppPreview preview={detail.previews[lang]} lang={lang} /> : <GooglePreview preview={detail.previews[lang]} device={view} lang={lang} />}
        </Section>

        <Section title="الفحوصات">
          <ChecksList checks={detail.checks[lang]} />
        </Section>

        <Section title="الاقتراحات" aside={<AcceptAllButton productId={detail.id} count={acceptable} />}>
          {hasChanges ? (
            <div className="overflow-hidden rounded-xl border border-warm-200 bg-white">
              <ChangesTable product={detail.changes} />
            </div>
          ) : (
            <p className="rounded-xl border border-warm-200 bg-white p-3 text-sm text-warm-600">ما كاين حتى اقتراح. ضغط «توليد بالذكاء الاصطناعي» الفوق.</p>
          )}
        </Section>
      </div>
    </SeoChangedContext.Provider>
  );
}

export function SeoDrawer({ productId, initialDetail, onClose }: { productId: string; initialDetail?: SeoDetail; onClose: () => void }) {
  const [detail, setDetail] = useState<SeoDetail | null>(initialDetail ?? null);
  const [failed, setFailed] = useState(false);
  const panel = useRef<HTMLElement>(null);

  const reload = useCallback(() => {
    loadSeoDetail(productId)
      .then((d) => {
        setDetail(d);
        setFailed(!d);
      })
      .catch(() => setFailed(true));
  }, [productId]);

  useEffect(() => {
    if (!initialDetail) reload();
  }, [initialDetail, reload]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      // Keyboard focus stays inside the open drawer.
      const items = panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,textarea,select");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      before?.focus();
    };
  }, [onClose]);

  // Out of the page's stacking contexts: the sticky header and animated wrappers cannot cover it.
  return createPortal(
    <div className="fixed inset-0 z-50" dir="rtl">
      <button type="button" aria-label="سد اللوحة" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={detail?.name ?? "تفاصيل السيو"} className="absolute inset-y-0 start-0 flex w-full max-w-xl flex-col bg-warm-50 shadow-2xl outline-none">
        <header className="flex items-center gap-3 border-b border-warm-200 bg-white p-3">
          {detail ? <ScoreRing score={detail.score} size={56} label={detail.name} /> : <span className="size-14 shrink-0 rounded-full bg-warm-100" />}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-extrabold text-ink">{detail?.name ?? "..."}</h2>
            <Link href={`/admin/products/${productId}`} className="inline-flex min-h-6 items-center gap-1 text-xs text-warm-600 underline underline-offset-2">
              <ExternalLink className="size-3" aria-hidden="true" />
              صفحة المنتج
            </Link>
          </div>
          <button type="button" onClick={onClose} aria-label="سد" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-warm-800 hover:bg-warm-100">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
          {detail ? (
            <SeoDrawerBody detail={detail} reload={reload} />
          ) : failed ? (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
              <CircleAlert className="size-4" aria-hidden="true" />
              ما قدرناش نحلو هاد المنتج.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-warm-600" role="status">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              كنحسبو...
            </p>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/** The cards, and the drawer they open. The score on a card updates as soon as the page refreshes. */
export function SeoGrid({ products, openId, initialDetail }: { products: SeoGridProduct[]; openId?: string; initialDetail?: SeoDetail }) {
  const [open, setOpen] = useState<string | null>(openId ?? null);
  const close = useCallback(() => setOpen(null), []);
  // The drawer needs document.body, which only exists in the browser.
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!products.length) {
    return (
      <p className="admin-card flex items-center gap-2 p-4 text-sm text-warm-600">
        <Circle className="size-4" aria-hidden="true" />
        ما كاين حتى منتج بهاد البحث.
      </p>
    );
  }
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onOpen={() => setOpen(p.id)} />
        ))}
      </div>
      {open && inBrowser ? <SeoDrawer productId={open} initialDetail={open === openId ? initialDetail : undefined} onClose={close} /> : null}
    </>
  );
}
