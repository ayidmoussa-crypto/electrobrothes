import { saveSettings } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  await requireAdmin();
  const s = await db.settings.findUnique({ where: { id: 1 } });

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
        </ActionForm>
      </Panel>
    </>
  );
}
