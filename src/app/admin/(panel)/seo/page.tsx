import { runSeoJobNow } from "@/app/actions/admin-seo";
import { ActionForm } from "@/components/admin/ActionForm";
import { CollapsedApplied, ProductAccordion } from "@/components/admin/SeoSuggestions";
import { inputClass, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { productChanges, suggestionViews } from "@/lib/seo-content/service";
import { TIME_ZONE } from "@/lib/time";

const when = new Intl.DateTimeFormat("ar-MA", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
const STOPPED: Record<string, string> = { budget: "وصلنا للسقف الشهري", deadline: "سالا الوقت", api_key: "مفتاح Claude API ما خدامش" };

export default async function SeoSuggestionsPage() {
  await requireAdmin();
  const [products, accepted, lastRun, settings] = await Promise.all([
    productChanges(),
    suggestionViews({ status: "ACCEPTED", autoApplied: false }, 30),
    db.seoRun.findFirst({ orderBy: { startedAt: "desc" } }),
    db.settings.findUnique({ where: { id: 1 }, select: { seoAutoApply: true } }),
  ]);

  return (
    <>
      <PageHeader title="مقترحات السيو" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 admin-card px-3 py-2">
        <p className="min-w-0 text-xs text-warm-600">
          التطبيق التلقائي {settings?.seoAutoApply ? "مفعّل" : "مطفي"}.
          {lastRun ? (
            <>
              {" "}
              آخر تشغيل {lastRun.trigger === "nightly" ? "ليلي" : "يدوي"}: {when.format(lastRun.startedAt)} · {lastRun.generated} منتج · {lastRun.autoApplied} تطبقو · {lastRun.failed} فشل
              {lastRun.stoppedBy ? ` · ${STOPPED[lastRun.stoppedBy] ?? lastRun.stoppedBy}` : ""}
            </>
          ) : null}
        </p>
        <ActionForm action={runSeoJobNow} submitLabel="شغّل دابا" className="flex flex-wrap items-center gap-2 [&_button]:!min-h-9 [&_button]:!px-3 [&_button]:!text-sm">
          <input name="limit" type="number" min={1} max={20} defaultValue={2} required dir="ltr" aria-label="عدد المنتجات" title="عدد المنتجات" className={`${inputClass} !min-h-9 !w-16 !text-sm`} />
        </ActionForm>
      </div>

      {products.length ? (
        <div className="space-y-1.5">
          {products.map((product, i) => (
            <ProductAccordion key={product.productId} product={product} defaultOpen={i === 0} />
          ))}
        </div>
      ) : (
        <Panel>
          <p className="text-sm text-warm-600">ما كاين حتى تعديل. شغّل المهمة، ولا ولّد من صفحة المنتج.</p>
        </Panel>
      )}

      {accepted.length ? (
        <div className="mt-1.5">
          <CollapsedApplied label={`اللي قبلتي (${accepted.length})`} rows={accepted} />
        </div>
      ) : null}
    </>
  );
}
