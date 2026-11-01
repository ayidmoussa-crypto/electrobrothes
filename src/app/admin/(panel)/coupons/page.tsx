import { deleteCoupon, saveCoupon } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { toMoroccanInput } from "@/lib/time";

type Coupon = {
  id?: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  usedCount?: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
};

const day = (d: Date | null) => (d ? toMoroccanInput(d, 10) : "");

function CouponFields({ c }: { c: Coupon }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <L label="الكود">
        <input name="code" defaultValue={c.code} required dir="ltr" className={`${inputClass} uppercase`} />
      </L>
      <L label="النوع">
        <select name="type" defaultValue={c.type} className={inputClass}>
          <option value="PERCENT">نسبة %</option>
          <option value="FIXED">مبلغ ثابت (درهم)</option>
        </select>
      </L>
      <L label="القيمة">
        <input name="value" type="number" min={1} defaultValue={c.value} required className={inputClass} />
      </L>
      <L label="حد أدنى للطلب">
        <input name="minSubtotal" type="number" min={0} defaultValue={c.minSubtotal ?? ""} className={inputClass} />
      </L>
      <L label="عدد الاستعمالات">
        <input name="maxUses" type="number" min={1} defaultValue={c.maxUses ?? ""} placeholder="غير محدود" className={inputClass} />
      </L>
      <L label="يبدأ في">
        <input name="startsAt" type="date" defaultValue={day(c.startsAt)} className={inputClass} />
      </L>
      <L label="ينتهي في">
        <input name="expiresAt" type="date" defaultValue={day(c.expiresAt)} className={inputClass} />
      </L>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm text-warm-800">
        <input type="checkbox" name="isActive" defaultChecked={c.isActive} className="size-5 accent-ink" />
        مفعّل
      </label>
    </div>
  );
}

export default async function CouponsPage() {
  await requireAdmin();
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <PageHeader title="كوبونات الخصم" description="النسبة المئوية محدودة في 90% كحد أقصى." />
      <Panel title="كوبون جديد" className="mb-4">
        <ActionForm action={saveCoupon} submitLabel="إضافة">
          <CouponFields c={{ code: "", type: "PERCENT", value: 10, minSubtotal: null, maxUses: null, startsAt: null, expiresAt: null, isActive: true }} />
        </ActionForm>
      </Panel>
      <ul className="flex flex-col gap-3">
        {coupons.map((c) => (
          <li key={c.id} className="admin-card p-4">
            <p className="mb-2 text-sm text-warm-600">
              استُعمل <b className="text-ink">{c.usedCount}</b> {c.maxUses ? `من ${c.maxUses}` : "مرة"}
            </p>
            <ActionForm action={saveCoupon} submitLabel="حفظ" variant="outline">
              <CouponFields c={c} />
            </ActionForm>
            <ActionForm action={deleteCoupon} submitLabel="حذف" variant="ghost" className="mt-2" confirm={`حذف الكوبون ${c.code}؟`}>
              <input type="hidden" name="id" value={c.id} />
            </ActionForm>
          </li>
        ))}
      </ul>
    </>
  );
}
