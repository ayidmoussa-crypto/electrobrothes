import { saveSettings } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
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
          <L label="رقم واتساب المتجر (بالصيغة الدولية بدون +، مثال: 212612345678)">
            <input name="whatsappNumber" inputMode="numeric" dir="ltr" defaultValue={s?.whatsappNumber ?? ""} className={inputClass} />
          </L>
          <L label="البريد الإلكتروني لإشعارات الطلبات الجديدة">
            <input name="notifyEmail" type="email" dir="ltr" defaultValue={s?.notifyEmail ?? ""} className={inputClass} />
          </L>
          <p className="text-xs text-warm-600">رقم واتساب يُستعمل في زر واتساب العائم وزر «أكّد طلبك عبر واتساب» في صفحة الشكر.</p>
          <L label="السقف الشهري للمساعد الذكي (بالدولار، 0 يوقفه)">
            <input name="assistantBudgetCents" type="number" min={0} max={1000} step={0.5} dir="ltr" defaultValue={(s?.assistantBudgetCents ?? 500) / 100} required className={inputClass} />
          </L>
          <p className="text-xs text-warm-600">
            استهلاك هذا الشهر: <span dir="ltr">${(usage.spentMicros / 1_000_000).toFixed(2)}</span>. عند بلوغ السقف يتوقف المساعد حتى بداية الشهر الموالي أو رفع السقف.
          </p>
        </ActionForm>
      </Panel>
    </>
  );
}
