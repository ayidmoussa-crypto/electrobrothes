import { saveHero, saveSettings } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { CopyLink } from "@/components/admin/CopyLink";
import { trackingLinks } from "@/lib/attribution";
import { siteUrl } from "@/lib/seo";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { usageSummary } from "@/lib/assistant/usage";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const [s, usage, products] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    usageSummary(),
    db.product.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, nameEn: true, isBestSeller: true }, orderBy: { nameAr: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title={tr("الإعدادات", "Settings")} />
      <Panel title={tr("واجهة الرئيسية", "Home page hero")} className="mb-6 max-w-2xl">
        <ActionForm action={saveHero} submitLabel={tr("حفظ الواجهة", "Save hero")}>
          <L label={tr("منتج الأسبوع", "Product of the week")}>
            <select name="heroProductId" defaultValue={s?.heroProductId ?? ""} className={inputClass}>
              <option value="">{tr("تلقائي: أحدث منتج «الأكثر مبيعاً»", "Automatic: newest best seller")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {lang === "en" ? p.nameEn : p.nameAr}
                  {p.isBestSeller ? ` ★` : ""}
                </option>
              ))}
            </select>
          </L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label={tr("عنوان بلاصة السمية (اختياري، عربي)", "Title instead of the name (optional, Arabic)")}>
              <input name="heroHeadlineAr" defaultValue={s?.heroHeadlineAr ?? ""} maxLength={80} className={inputClass} />
            </L>
            <L label={tr("عنوان بلاصة السمية (اختياري، إنجليزي)", "Title instead of the name (optional, English)")}>
              <input name="heroHeadlineEn" dir="ltr" defaultValue={s?.heroHeadlineEn ?? ""} maxLength={80} className={inputClass} />
            </L>
          </div>
          <p className="text-xs text-warm-600">
            {tr(
              "الثمن، الثمن القديم، الصورة وتاريخ نهاية العرض كيتاخدو من المنتج نيت. إلا كان المنتج ما فيهش ستوك ولا ما فيهش صورة، كيبان أحدث «الأكثر مبيعاً» بلاصتو.",
              "Price, old price, photo and deal end date come straight from the product. If it has no stock or no photo, the newest best seller shows instead.",
            )}
          </p>
        </ActionForm>
      </Panel>
      <Panel title={tr("المتجر", "Shop")} className="max-w-2xl">
        <ActionForm action={saveSettings} submitLabel={tr("حفظ الإعدادات", "Save settings")}>
          <L label={tr("حد التوصيل المجاني (درهم)", "Free delivery from (MAD)")}>
            <input name="freeShippingThreshold" type="number" min={0} defaultValue={s?.freeShippingThreshold ?? 1000} required className={inputClass} />
          </L>
          <L label={tr("رقم واتساب المتجر (رقم مغربي، مثال: 0612345678)", "Shop WhatsApp number (Moroccan, e.g. 0612345678)")}>
            <input name="whatsappNumber" type="tel" inputMode="tel" dir="ltr" defaultValue={s?.whatsappNumber ?? ""} className={inputClass} />
          </L>
          <L label={tr("البريد الإلكتروني لإشعارات الطلبات الجديدة", "Email for new order alerts")}>
            <input name="notifyEmail" type="email" dir="ltr" defaultValue={s?.notifyEmail ?? ""} className={inputClass} />
          </L>
          <p className="text-xs text-warm-600">{tr("رقم واتساب يُستعمل في زر واتساب العائم وزر «أكّد طلبك عبر واتساب» في صفحة الشكر.", "The WhatsApp number is used by the floating WhatsApp button and the “Confirm on WhatsApp” button on the thank-you page.")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label={tr("مدة التوصيل بالعربية", "Delivery time in Arabic")}>
              <input name="deliveryTimeAr" defaultValue={s?.deliveryTimeAr ?? "2 إلى 5 أيام"} required maxLength={60} className={inputClass} />
            </L>
            <L label={tr("مدة التوصيل بالإنجليزية", "Delivery time in English")}>
              <input name="deliveryTimeEn" dir="ltr" defaultValue={s?.deliveryTimeEn ?? "2 to 5 days"} required maxLength={60} className={inputClass} />
            </L>
          </div>
          <L label={tr("سياسة الاستبدال بالعربية", "Replacement policy in Arabic")}>
            <textarea name="replacementPolicyAr" rows={2} defaultValue={s?.replacementPolicyAr ?? ""} required maxLength={500} className={`${inputClass} py-2`} />
          </L>
          <L label={tr("سياسة الاستبدال بالإنجليزية", "Replacement policy in English")}>
            <textarea name="replacementPolicyEn" rows={2} dir="ltr" defaultValue={s?.replacementPolicyEn ?? ""} required maxLength={500} className={`${inputClass} py-2`} />
          </L>
          <p className="text-xs text-warm-600">{tr("تظهر في صفحات المتجر، والمساعد الذكي ينقلها حرفياً ولا يكتب وعوداً من عنده.", "Shown on the shop pages; the assistant copies it word for word and never writes promises of its own.")}</p>
          <L label={tr("السقف الشهري للمساعد الذكي (بالدولار، 0 يوقفه)", "Assistant monthly cap (USD, 0 turns it off)")}>
            <input name="assistantBudgetCents" type="number" min={0} max={1000} step={0.5} dir="ltr" defaultValue={(s?.assistantBudgetCents ?? 500) / 100} required className={inputClass} />
          </L>
          <p className="text-xs text-warm-600">
            {tr("استهلاك هذا الشهر:", "Spent this month:")} <span dir="ltr">${(usage.spentMicros / 1_000_000).toFixed(2)}</span>.{" "}
            {tr("عند بلوغ السقف يتوقف المساعد ومهمة السيو حتى بداية الشهر الموالي أو رفع السقف.", "At the cap, the assistant and the SEO job stop until next month or until you raise the cap.")}
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-ink">
            <input name="seoAutoApply" type="checkbox" defaultChecked={s?.seoAutoApply ?? true} className="mt-1 size-4" />
            <span>
              {tr("طبّق محتوى السيو تلقائياً", "Apply SEO content automatically")}
              <span className="block text-xs font-normal text-warm-600">{tr("الوصف، عناوين السيو، meta، alt والأسئلة الشائعة، مع زر تراجع. المواصفات اللي فيها أرقام، «خاص التحقق»، القسم، الماركة والرابط كيتسناو موافقتك دائماً.", "Description, SEO titles, meta, alt and FAQs, with an undo button. Specs with numbers, “needs checking”, category, brand and link always wait for your approval.")}</span>
            </span>
          </label>
        </ActionForm>
      </Panel>

      <section id="tracking" className="admin-card mt-6 max-w-2xl scroll-mt-28 p-4 md:p-5">
        <h2 className="text-base">{tr("روابط التتبع", "Tracking links")}</h2>
        <p className="mt-1 text-sm text-warm-600">
          {tr("حط كل رابط فبلاصتو، والطلبات اللي جاو منو كيتحسبو ليه فـ«مصادر المبيعات» فالمالية. فالإعلانات، بدّل", "Put each link in its place; orders that come from it count for it under “Sales sources” in Finance. In ads, replace")}{" "}
          <span dir="ltr" className="font-mono">smiyat-l-i3lan</span> {tr("بسمية الإعلان.", "with the ad's name.")}
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {trackingLinks(siteUrl(), lang).map((l) => (
            <CopyLink key={l.url} label={l.where} url={l.url} />
          ))}
        </div>
        <p className="mt-4 text-xs text-warm-600">
          {tr(
            "إعلانات Google كتتعرف بوحدها. الزوار اللي جاو من البحث فـ Google ولا من رابط بلا هاد الزيادة كيتعرفو من الصفحة اللي جاو منها، ولكن التطبيقات ديال إنستغرام وتيك توك بزاف المرات كيخبيوها، وداكشي علاش هاد الروابط مهمين. كيتحسب آخر مصدر معروف فـ 30 يوم قبل الطلب.",
            "Google Ads are recognised on their own. Visitors from Google search or from a link without this addition are recognised from the page they came from, but the Instagram and TikTok apps often hide it, which is why these links matter. The last known source in the 30 days before the order counts.",
          )}
        </p>
      </section>
    </>
  );
}
