import { saveSettings } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { CopyLink } from "@/components/admin/CopyLink";
import { trackingLinks } from "@/lib/attribution";
import { siteUrl } from "@/lib/seo";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { usageSummary } from "@/lib/assistant/usage";
import { budgetMonth } from "@/lib/assistant/rules";
import { SUPPORT_ACTOR } from "@/lib/support/rules";
import { db } from "@/lib/db";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("إعدادات المتجر", "Shop settings");

export default async function SettingsPage() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const [s, usage, support] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    usageSummary(),
    db.assistantUsage.aggregate({ where: { month: budgetMonth(), actor: SUPPORT_ACTOR }, _sum: { costMicros: true } }),
  ]);
  const supportSpent = support._sum.costMicros ?? 0;

  return (
    <>
      <PageHeader title={tr("الإعدادات", "Settings")} />
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
          <L label={tr("صفحات العروض: من هاد الثمن (درهم) الذكاء الاصطناعي كيختار القالب «تحريري»", "Offer pages: from this price (MAD) the AI picks the “Editorial” template")}>
            <input name="landingEditorialFrom" type="number" min={0} dir="ltr" defaultValue={s?.landingEditorialFrom ?? 1500} required className={inputClass} />
          </L>
          <L label={tr("السقف الشهري للمساعد الذكي (بالدولار، 0 يوقفه)", "Assistant monthly cap (USD, 0 turns it off)")}>
            <input name="assistantBudgetCents" type="number" min={0} max={1000} step={0.5} dir="ltr" defaultValue={(s?.assistantBudgetCents ?? 500) / 100} required className={inputClass} />
          </L>
          <p className="text-xs text-warm-600">
            {tr("استهلاك هذا الشهر:", "Spent this month:")} <span dir="ltr">${(usage.spentMicros / 1_000_000).toFixed(2)}</span>.{" "}
            {tr("عند بلوغ السقف يتوقف المساعد ومهمة السيو حتى بداية الشهر الموالي أو رفع السقف.", "At the cap, the assistant and the SEO job stop until next month or until you raise the cap.")}
          </p>
          <L label={tr("السقف الشهري لشات الدعم التقني ديال الزبناء (بالدولار، 0 يوقفو)", "Customer support chat monthly cap (USD, 0 turns it off)")}>
            <input name="supportBudgetCents" type="number" min={0} max={1000} step={0.5} dir="ltr" defaultValue={(s?.supportBudgetCents ?? 300) / 100} required className={inputClass} />
          </L>
          <p className="text-xs text-warm-600">
            {tr("استهلاك هذا الشهر:", "Spent this month:")} <span dir="ltr">${(supportSpent / 1_000_000).toFixed(2)}</span>.{" "}
            {tr("عند بلوغ السقف، كل محادثة جديدة كتحول ليك مباشرة بلا ذكاء اصطناعي.", "At the cap, every new conversation goes straight to you, without AI.")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label={tr("تخفيض الشكر ملي يتحل المشكل (%، 0 يوقفو)", "Thank-you discount when solved (%, 0 turns it off)")}>
              <input name="supportRewardPercent" type="number" min={0} max={50} dir="ltr" defaultValue={s?.supportRewardPercent ?? 10} required className={inputClass} />
            </L>
            <L label={tr("صالح لمدة (أيام)", "Valid for (days)")}>
              <input name="supportRewardDays" type="number" min={1} max={365} dir="ltr" defaultValue={s?.supportRewardDays ?? 30} required className={inputClass} />
            </L>
          </div>
          <p className="text-xs text-warm-600">{tr("ملي الزبون يأكد بلي تحل المشكل، كياخد كود خاص بيه (MERCI-...) كيخدم مرة وحدة. كود واحد لكل طلبية. كيبانو فصفحة الكوبونات.", "When a customer confirms the problem is fixed, they get a personal one-use code (MERCI-...). One code per order. They appear on the coupons page.")}</p>
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
