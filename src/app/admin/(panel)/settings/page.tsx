import { saveSettings } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { CopyLink } from "@/components/admin/CopyLink";
import { trackingLinks } from "@/lib/attribution";
import { siteUrl } from "@/lib/seo";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { usageSummary } from "@/lib/assistant/usage";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  await requireAdmin();
  const [s, usage] = await Promise.all([db.settings.findUnique({ where: { id: 1 } }), usageSummary()]);

  return (
    <>
      <PageHeader title="الإعدادات" />
      <Panel title="المتجر" className="max-w-2xl">
        <ActionForm action={saveSettings} submitLabel="حفظ الإعدادات">
          <L label="حد التوصيل المجاني (درهم)">
            <input name="freeShippingThreshold" type="number" min={0} defaultValue={s?.freeShippingThreshold ?? 1000} required className={inputClass} />
          </L>
          <L label="رقم واتساب المتجر (رقم مغربي، مثال: 0612345678)">
            <input name="whatsappNumber" type="tel" inputMode="tel" dir="ltr" defaultValue={s?.whatsappNumber ?? ""} className={inputClass} />
          </L>
          <L label="البريد الإلكتروني لإشعارات الطلبات الجديدة">
            <input name="notifyEmail" type="email" dir="ltr" defaultValue={s?.notifyEmail ?? ""} className={inputClass} />
          </L>
          <p className="text-xs text-warm-600">رقم واتساب يُستعمل في زر واتساب العائم وزر «أكّد طلبك عبر واتساب» في صفحة الشكر.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="مدة التوصيل بالعربية">
              <input name="deliveryTimeAr" defaultValue={s?.deliveryTimeAr ?? "2 إلى 5 أيام"} required maxLength={60} className={inputClass} />
            </L>
            <L label="مدة التوصيل بالإنجليزية">
              <input name="deliveryTimeEn" dir="ltr" defaultValue={s?.deliveryTimeEn ?? "2 to 5 days"} required maxLength={60} className={inputClass} />
            </L>
          </div>
          <L label="سياسة الاستبدال بالعربية">
            <textarea name="replacementPolicyAr" rows={2} defaultValue={s?.replacementPolicyAr ?? ""} required maxLength={500} className={`${inputClass} py-2`} />
          </L>
          <L label="سياسة الاستبدال بالإنجليزية">
            <textarea name="replacementPolicyEn" rows={2} dir="ltr" defaultValue={s?.replacementPolicyEn ?? ""} required maxLength={500} className={`${inputClass} py-2`} />
          </L>
          <p className="text-xs text-warm-600">تظهر في صفحات المتجر، والمساعد الذكي ينقلها حرفياً ولا يكتب وعوداً من عنده.</p>
          <L label="السقف الشهري للمساعد الذكي (بالدولار، 0 يوقفه)">
            <input name="assistantBudgetCents" type="number" min={0} max={1000} step={0.5} dir="ltr" defaultValue={(s?.assistantBudgetCents ?? 500) / 100} required className={inputClass} />
          </L>
          <p className="text-xs text-warm-600">
            استهلاك هذا الشهر: <span dir="ltr">${(usage.spentMicros / 1_000_000).toFixed(2)}</span>. عند بلوغ السقف يتوقف المساعد ومهمة السيو حتى بداية الشهر الموالي أو رفع السقف.
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-ink">
            <input name="seoAutoApply" type="checkbox" defaultChecked={s?.seoAutoApply ?? true} className="mt-1 size-4" />
            <span>
              طبّق محتوى السيو تلقائياً
              <span className="block text-xs font-normal text-warm-600">الوصف، عناوين السيو، meta، alt والأسئلة الشائعة، مع زر تراجع. المواصفات اللي فيها أرقام، «خاص التحقق»، القسم، الماركة والرابط كيتسناو موافقتك دائماً.</span>
            </span>
          </label>
        </ActionForm>
      </Panel>

      <section id="tracking" className="admin-card mt-6 max-w-2xl scroll-mt-28 p-4 md:p-5">
        <h2 className="text-base">روابط التتبع</h2>
        <p className="mt-1 text-sm text-warm-600">
          حط كل رابط فبلاصتو، والطلبات اللي جاو منو كيتحسبو ليه فـ«مصادر المبيعات» فالمالية. فالإعلانات، بدّل <span dir="ltr" className="font-mono">smiyat-l-i3lan</span> بسمية الإعلان.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {trackingLinks(siteUrl()).map((l) => (
            <CopyLink key={l.url} label={l.where} url={l.url} />
          ))}
        </div>
        <p className="mt-4 text-xs text-warm-600">
          إعلانات Google كتتعرف بوحدها. الزوار اللي جاو من البحث فـ Google ولا من رابط بلا هاد الزيادة كيتعرفو من الصفحة اللي جاو منها، ولكن التطبيقات ديال إنستغرام وتيك توك بزاف المرات كيخبيوها، وداكشي علاش هاد الروابط مهمين. كيتحسب آخر مصدر معروف فـ 30 يوم قبل الطلب.
        </p>
      </section>
    </>
  );
}
