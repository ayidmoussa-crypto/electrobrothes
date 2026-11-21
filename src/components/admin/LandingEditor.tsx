"use client";

import { Select } from "@/components/ui/Select";
import { ArrowDown, ArrowUp, CircleAlert, Eye, EyeOff, LoaderCircle, Lock, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { aiLandingPage, aiLandingSection } from "@/app/actions/admin-campaign-ai";
import { publishLanding, saveLandingDraft, unpublishLanding, type LandingSaveState } from "@/app/actions/admin-landing";
import { buttonClass } from "@/components/ui/button";
import { LANDING_ICONS, SECTION_LABEL, TEMPLATE_LABEL, TEMPLATES, words, type LandingDraft, type LandingIcon, type PublishedLanding, type SectionSetting } from "@/lib/landing";
import { AiButton } from "./AiButton";
import { useAdminTr } from "./AdminLang";
import { inputClass, L, Panel } from "./ui";

const counter = (text: string, max: number) => {
  const n = words(text);
  return <span className={`text-xs tabular-nums ${n > max ? "font-bold text-danger" : "text-warm-500"}`}>{`${n}/${max}`}</span>;
};

/**
 * The landing page builder: pick a template, order or hide the middle sections (the hero stays first and the order
 * form last), edit every text, then save, preview or publish. Prices, stock and photos are not here on purpose:
 * the page always takes them from the product.
 */
export function LandingEditor({ productId, slug, initial, publishedAt: initialPublishedAt }: { productId: string; slug: string; initial: PublishedLanding; publishedAt: string | null }) {
  const { tr, lang } = useAdminTr();
  const [template, setTemplate] = useState(initial.template);
  const [sections, setSections] = useState<SectionSetting[]>(initial.sections);
  const [content, setContent] = useState<LandingDraft>(initial.content);
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [result, setResult] = useState<LandingSaveState>({});
  const [pending, start] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [aiNote, setAiNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiSection, setAiSection] = useState<string | null>(null);

  const regenerate = (section: "headline" | "features" | "comparison" | "faq") => {
    setAiSection(section);
    startAi(async () => {
      const r = await aiLandingSection(productId, section);
      setAiSection(null);
      if (!r.ok) return setAiNote({ ok: false, text: r.message });
      setContent((c) => ({ ...c, ...r.part }));
      setAiNote({
        ok: !r.fallback,
        text: r.fallback
          ? tr("الذكاء الاصطناعي ما عطاش جواب صالح، فحطينا نص من معلومات المنتج. راجعو.", "The AI gave no valid answer, so text from the product data was used. Check it.")
          : tr("تبدل هاد القسم. شوفو وحفظ ملي يعجبك.", "This section changed. Review it and save when happy."),
      });
    });
  };
  const regenButton = (section: "headline" | "features" | "comparison" | "faq") => (
    <AiButton pending={aiPending && aiSection === section} onClick={() => regenerate(section)} className="min-h-9 px-3 text-sm">
      {tr("إعادة التوليد", "Regenerate")}
    </AiButton>
  );

  const payload = () => ({ productId, template, sections, content });
  const run = (task: () => Promise<LandingSaveState>, after?: (r: LandingSaveState) => void) =>
    start(async () => {
      const r = await task();
      setResult(r);
      if (r.publishedAt !== undefined) setPublishedAt(r.publishedAt);
      after?.(r);
    });

  const set = <K extends keyof LandingDraft>(key: K, value: LandingDraft[K]) => setContent((c) => ({ ...c, [key]: value }));
  const move = (i: number, by: -1 | 1) =>
    setSections((s) => {
      const next = [...s];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  return (
    <div className="grid max-w-4xl gap-6">
      <Panel title={tr("الذكاء الاصطناعي", "AI")}>
        <p className="mb-3 text-sm text-warm-600">
          {tr(
            "كيكتب النصوص من معلومات المنتج فقط، وكيختار القالب حسب القواعد. كيتحفظ كمسودة، والزبناء ما كيشوفو والو حتى تضغط «نشر».",
            "Writes the texts from the product data only and picks the template by the rules. Saved as a draft; shoppers see nothing until you click “Publish”.",
          )}
        </p>
        <AiButton
          pending={aiPending && aiSection === "page"}
          onClick={() => {
            setAiSection("page");
            startAi(async () => {
              const r = await aiLandingPage(productId);
              setAiSection(null);
              if (!r.ok) return setAiNote({ ok: false, text: r.message });
              setTemplate(r.template);
              setContent(r.content);
              setAiNote({
                ok: !r.fallback,
                text: r.fallback
                  ? tr("الذكاء الاصطناعي ما عطاش جواب صالح، فتحفظات مسودة من معلومات المنتج. كمّلها وراجعها.", "The AI gave no valid answer, so a draft from the product data was saved. Complete and check it.")
                  : tr("تحفظات مسودة جديدة. راجعها ومن بعد انشر.", "A new draft was saved. Review it, then publish."),
              });
            });
          }}
        >
          {tr("ولّد الصفحة كاملة", "Generate the whole page")}
        </AiButton>
        {aiNote ? (
          <p role="status" className={`mt-3 text-sm font-semibold ${aiNote.ok ? "text-success" : "text-danger"}`}>
            {aiNote.text}
          </p>
        ) : null}
      </Panel>

      <Panel title={tr("اختيار القالب", "Choose the template")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((key) => (
            <label key={key} className="flex cursor-pointer gap-3 rounded-xl border border-warm-200 p-3 has-checked:border-ink has-checked:bg-yellow-50">
              <input type="radio" name="template" value={key} checked={template === key} onChange={() => setTemplate(key)} className="mt-1 size-4" />
              <span>
                <b className="block text-ink">{TEMPLATE_LABEL[key][lang]}</b>
                <span className="text-sm text-warm-600">{lang === "en" ? TEMPLATE_LABEL[key].hintEn : TEMPLATE_LABEL[key].hintAr}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title={tr("الأقسام", "Sections")}>
        <ol className="flex flex-col gap-2">
          <li className="flex min-h-12 items-center gap-3 rounded-lg bg-warm-100 px-3 text-warm-700">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-semibold">{SECTION_LABEL.hero[lang]}</span>
            <span className="text-xs">{tr("ديما الأول", "Always first")}</span>
          </li>
          {sections.map((s, i) => (
            <li key={s.key} className={`flex min-h-12 items-center gap-2 rounded-lg border border-warm-200 px-3 ${s.hidden ? "bg-warm-50 text-warm-500" : "bg-white text-ink"}`}>
              <span className="flex-1 font-semibold">
                {SECTION_LABEL[s.key][lang]}
                {s.key === "reviews" ? <span className="block text-xs font-normal text-warm-600">{tr("كيبان غير إلا كانو آراء حقيقية.", "Shows only when there are real reviews.")}</span> : null}
              </span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={tr("طلّع", "Move up")} className={buttonClass({ variant: "ghost", size: "icon" })}>
                <ArrowUp className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={tr("هبّط", "Move down")} className={buttonClass({ variant: "ghost", size: "icon" })}>
                <ArrowDown className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setSections((all) => all.map((x) => (x.key === s.key ? { ...x, hidden: !x.hidden } : x)))}
                aria-pressed={s.hidden}
                aria-label={s.hidden ? tr("بيّن", "Show") : tr("خبّي", "Hide")}
                className={buttonClass({ variant: "ghost", size: "icon" })}
              >
                {s.hidden ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
          <li className="flex min-h-12 items-center gap-3 rounded-lg bg-warm-100 px-3 text-warm-700">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-semibold">{SECTION_LABEL.order[lang]}</span>
            <span className="text-xs">{tr("ديما فالآخر", "Always last")}</span>
          </li>
        </ol>
      </Panel>

      <Panel title={tr("النصوص", "Texts")}>
        <div className="flex flex-col gap-4">
          <div className="self-start">{regenButton("headline")}</div>
          <L label={tr("العنوان (8 كلمات على الأكثر)", "Headline (8 words max)")}>
            <input value={content.headline} onChange={(e) => set("headline", e.target.value)} maxLength={120} className={inputClass} />
            {counter(content.headline, 8)}
          </L>
          <L label={tr("الجملة تحت العنوان (20 كلمة على الأكثر)", "Line under the headline (20 words max)")}>
            <textarea value={content.subline} onChange={(e) => set("subline", e.target.value)} maxLength={240} rows={2} className={`${inputClass} py-2`} />
            {counter(content.subline, 20)}
          </L>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-bold text-ink">{tr("المميزات (3 حتى 5)", "Features (3 to 5)")}</legend>
            <div className="self-start">{regenButton("features")}</div>
            {content.features.map((f, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-warm-200 p-3 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end">
                <L label={tr(`عنوان ${i + 1} (4 كلمات)`, `Title ${i + 1} (4 words)`)}>
                  <input value={f.title} onChange={(e) => set("features", content.features.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={60} className={inputClass} />
                  {counter(f.title, 4)}
                </L>
                <L label={tr("النص (15 كلمة)", "Text (15 words)")}>
                  <input value={f.text} onChange={(e) => set("features", content.features.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} maxLength={200} className={inputClass} />
                  {counter(f.text, 15)}
                </L>
                <L label={tr("الأيقونة", "Icon")}>
                  <Select value={f.icon} onChange={(e) => set("features", content.features.map((x, j) => (j === i ? { ...x, icon: e.target.value as LandingIcon } : x)))} className={inputClass}>
                    {LANDING_ICONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </Select>
                </L>
                <button type="button" onClick={() => set("features", content.features.filter((_, j) => j !== i))} aria-label={tr(`حذف الميزة ${i + 1}`, `Remove feature ${i + 1}`)} className={buttonClass({ variant: "ghost", size: "icon", className: "mb-5" })}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {content.features.length < 5 ? (
              <button type="button" onClick={() => set("features", [...content.features, { title: "", text: "", icon: "sparkles" }])} className={buttonClass({ variant: "outline", className: "self-start" })}>
                <Plus className="size-4" aria-hidden="true" />
                {tr("زيد ميزة", "Add a feature")}
              </button>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 font-bold text-ink">{tr("مقارنة تقنية (اختياري)", "Technical comparison (optional)")}</legend>
            <div className="self-start">{regenButton("comparison")}</div>
            <p className="text-sm text-warm-600">{tr("الخيارات والثمن ديال كل لون كيتزادو بوحدهم من المنتج. هنا غير سطور إضافية: الخاصية والقيمة.", "Options and the price of each colour are added from the product on their own. Here only extra rows: property and value.")}</p>
            {content.comparison.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <L label={tr("الخاصية", "Property")}>
                  <input value={r.label} onChange={(e) => set("comparison", content.comparison.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={60} className={inputClass} />
                </L>
                <L label={tr("القيم (فرّق بفاصلة)", "Values (comma separated)")}>
                  <input
                    value={r.values.join("، ")}
                    onChange={(e) => set("comparison", content.comparison.map((x, j) => (j === i ? { ...x, values: e.target.value.split(/[،,]\s*/).slice(0, 6) } : x)))}
                    className={inputClass}
                  />
                </L>
                <button type="button" onClick={() => set("comparison", content.comparison.filter((_, j) => j !== i))} aria-label={tr("حذف السطر", "Remove row")} className={buttonClass({ variant: "ghost", size: "icon" })}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {content.comparison.length < 10 ? (
              <button type="button" onClick={() => set("comparison", [...content.comparison, { label: "", values: [""] }])} className={buttonClass({ variant: "outline", className: "self-start" })}>
                <Plus className="size-4" aria-hidden="true" />
                {tr("زيد سطر", "Add a row")}
              </button>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-bold text-ink">{tr("أسئلة شائعة (اختياري)", "FAQ (optional)")}</legend>
            <div className="self-start">{regenButton("faq")}</div>
            {content.faq.map((f, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-warm-200 p-3">
                <L label={tr("السؤال", "Question")}>
                  <input value={f.q} onChange={(e) => set("faq", content.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} maxLength={160} className={inputClass} />
                </L>
                <L label={tr("الجواب", "Answer")}>
                  <textarea value={f.a} onChange={(e) => set("faq", content.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} maxLength={400} rows={2} className={`${inputClass} py-2`} />
                </L>
                <button type="button" onClick={() => set("faq", content.faq.filter((_, j) => j !== i))} className={buttonClass({ variant: "ghost", className: "self-start text-danger" })}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  {tr("حذف السؤال", "Remove question")}
                </button>
              </div>
            ))}
            {content.faq.length < 6 ? (
              <button type="button" onClick={() => set("faq", [...content.faq, { q: "", a: "" }])} className={buttonClass({ variant: "outline", className: "self-start" })}>
                <Plus className="size-4" aria-hidden="true" />
                {tr("زيد سؤال", "Add a question")}
              </button>
            ) : null}
          </fieldset>
        </div>
      </Panel>

      {/* Sticks to the bottom of the screen so saving is always one click away. */}
      <div className="admin-card sticky bottom-3 z-10 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => saveLandingDraft(payload()))} className={buttonClass({ variant: "outline" })}>
            {tr("حفظ المسودة", "Save draft")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              // Opened now (before the await) so the browser does not block it as a pop-up.
              const tab = window.open("about:blank", "_blank");
              run(
                () => saveLandingDraft(payload()),
                (r) => {
                  if (r.ok && tab) tab.location.href = `/offers/${slug}/preview`;
                  else tab?.close();
                },
              );
            }}
            className={buttonClass({ variant: "outline" })}
          >
            <Eye className="size-4" aria-hidden="true" />
            {tr("حفظ ومعاينة", "Save and preview")}
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => publishLanding(payload()))} className={buttonClass()}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {publishedAt ? tr("نشر التعديلات", "Publish changes") : tr("نشر", "Publish")}
          </button>
          {publishedAt ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => unpublishLanding(productId))} className={buttonClass({ variant: "ghost", className: "text-danger" })}>
                {tr("إيقاف النشر", "Unpublish")}
              </button>
              <a href={`/offers/${slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-ink underline underline-offset-4">
                {tr("فتح الصفحة المنشورة", "Open the live page")}
              </a>
            </>
          ) : null}
        </div>
        {result.message ? (
          <div role="status" className={`text-sm font-semibold ${result.ok ? "text-success" : "text-danger"}`}>
            <p className="flex items-center gap-1.5">
              {result.ok ? null : <CircleAlert className="size-4 shrink-0" aria-hidden="true" />}
              {result.message}
            </p>
            {result.problems?.length ? (
              <ul className="ms-6 mt-1 list-disc font-normal">
                {result.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
