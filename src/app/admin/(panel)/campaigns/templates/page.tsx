import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { TEMPLATE_LABEL, TEMPLATES } from "@/lib/landing";
import { OFFER_STYLE_LABEL, OFFER_STYLES } from "@/lib/offers";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("قوالب العروض", "Campaign templates");

/** A small drawing of each layout, in brand colours, so the owner sees the shape without any brand's pictures. */
function Sketch({ dark, cards = false }: { dark: boolean; cards?: boolean }) {
  const line = dark ? "bg-warm-700" : "bg-warm-300";
  return (
    <div aria-hidden="true" className={`flex h-32 flex-col items-center gap-1.5 rounded-xl p-3 ${dark ? "bg-ink" : "bg-warm-100"}`}>
      <span className={`h-1.5 w-12 rounded-full ${dark ? "bg-yellow-500" : "bg-ink"}`} />
      <span className={`h-3 w-32 rounded ${dark ? "bg-white" : "bg-ink"}`} />
      <span className={`h-1.5 w-24 rounded ${line}`} />
      {cards ? (
        <span className="grid grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-2 w-12 rounded ${line}`} />
          ))}
        </span>
      ) : null}
      <span className="h-3 w-16 rounded-full bg-yellow-500" />
      <span className={`mt-auto h-8 w-20 rounded-lg ${dark ? "bg-warm-900" : "bg-white"}`} />
    </div>
  );
}

export default async function CampaignTemplates() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  return (
    <>
      <PageHeader title={tr("القوالب", "Templates")} description={tr("القوالب ثابتة فالكود: كتبدل غير النصوص والصورة. الثمن والستوك ديما من المنتج.", "Templates are fixed in code: only texts and the photo change. Price and stock always come from the product.")} />
      <Panel title={tr("أشكال عروض الرئيسية", "Home offer looks")} className="mb-6">
        <ul className="grid gap-4 sm:grid-cols-3">
          {OFFER_STYLES.map((s) => (
            <li key={s} className="flex flex-col gap-2">
              <Sketch dark={s !== "light"} cards={s === "features"} />
              <b className="text-ink">{OFFER_STYLE_LABEL[s][lang]}</b>
              <span className="text-sm text-warm-600">{lang === "en" ? OFFER_STYLE_LABEL[s].hintEn : OFFER_STYLE_LABEL[s].hintAr}</span>
            </li>
          ))}
        </ul>
        <Link href="/admin/campaigns/new" className={buttonClass({ className: "mt-4" })}>
          {tr("إنشاء عرض", "New offer")}
        </Link>
      </Panel>
      <Panel title={tr("قوالب صفحات العروض", "Offer page templates")}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {TEMPLATES.map((key) => (
            <li key={key} className="rounded-xl border border-warm-200 p-4">
              <b className="block text-ink">{TEMPLATE_LABEL[key][lang]}</b>
              <span className="text-sm text-warm-600">{lang === "en" ? TEMPLATE_LABEL[key].hintEn : TEMPLATE_LABEL[key].hintAr}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-warm-600">{tr("فكل قالب: الثمن و«اطلب الآن» فالواجهة، سطر الثقة، شريط لاصق فالتيليفون، واستمارة الدفع عند الاستلام فالآخر.", "Every template: price and order button in the hero, the trust line, a sticky phone bar and the cash-on-delivery form at the end.")}</p>
        <Link href="/admin/landing" className={buttonClass({ variant: "outline", className: "mt-4" })}>
          {tr("صفحات العروض", "Offer pages")}
        </Link>
      </Panel>
    </>
  );
}
