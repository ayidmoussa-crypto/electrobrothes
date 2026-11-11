import { deleteCoupon, saveCoupon } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { adminTr, type Tr } from "@/lib/admin-lang";
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

function CouponFields({ c, tr }: { c: Coupon; tr: Tr }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <L label={tr("الكود", "Code")}>
        <input name="code" defaultValue={c.code} required dir="ltr" className={`${inputClass} uppercase`} />
      </L>
      <L label={tr("النوع", "Type")}>
        <select name="type" defaultValue={c.type} className={inputClass}>
          <option value="PERCENT">{tr("نسبة %", "Percent %")}</option>
          <option value="FIXED">{tr("مبلغ ثابت (درهم)", "Fixed amount (MAD)")}</option>
        </select>
      </L>
      <L label={tr("القيمة", "Value")}>
        <input name="value" type="number" min={1} defaultValue={c.value} required className={inputClass} />
      </L>
      <L label={tr("حد أدنى للطلب", "Minimum order")}>
        <input name="minSubtotal" type="number" min={0} defaultValue={c.minSubtotal ?? ""} className={inputClass} />
      </L>
      <L label={tr("عدد الاستعمالات", "Number of uses")}>
        <input name="maxUses" type="number" min={1} defaultValue={c.maxUses ?? ""} placeholder={tr("غير محدود", "Unlimited")} className={inputClass} />
      </L>
      <L label={tr("يبدأ في", "Starts on")}>
        <input name="startsAt" type="date" defaultValue={day(c.startsAt)} className={inputClass} />
      </L>
      <L label={tr("ينتهي في", "Ends on")}>
        <input name="expiresAt" type="date" defaultValue={day(c.expiresAt)} className={inputClass} />
      </L>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm text-warm-800">
        <input type="checkbox" name="isActive" defaultChecked={c.isActive} className="size-5 accent-ink" />
        {tr("مفعّل", "Active")}
      </label>
    </div>
  );
}

export default async function CouponsPage() {
  const [, { tr }] = await Promise.all([requireAdmin(), adminTr()]);
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <PageHeader title={tr("كوبونات الخصم", "Discount coupons")} description={tr("النسبة المئوية محدودة في 90% كحد أقصى.", "A percentage is capped at 90%.")} />
      <Panel title={tr("كوبون جديد", "New coupon")} className="mb-4">
        <ActionForm action={saveCoupon} submitLabel={tr("إضافة", "Add")}>
          <CouponFields tr={tr} c={{ code: "", type: "PERCENT", value: 10, minSubtotal: null, maxUses: null, startsAt: null, expiresAt: null, isActive: true }} />
        </ActionForm>
      </Panel>
      <ul className="flex flex-col gap-3">
        {coupons.map((c) => (
          <li key={c.id} className="admin-card p-4">
            <p className="mb-2 text-sm text-warm-600">
              {tr("استُعمل", "Used")} <b className="text-ink">{c.usedCount}</b> {c.maxUses ? tr(`من ${c.maxUses}`, `of ${c.maxUses}`) : tr("مرة", "times")}
            </p>
            <ActionForm action={saveCoupon} submitLabel={tr("حفظ", "Save")} variant="outline">
              <CouponFields tr={tr} c={c} />
            </ActionForm>
            <ActionForm action={deleteCoupon} submitLabel={tr("حذف", "Delete")} variant="ghost" className="mt-2" confirm={tr(`حذف الكوبون ${c.code}؟`, `Delete coupon ${c.code}?`)}>
              <input type="hidden" name="id" value={c.id} />
            </ActionForm>
          </li>
        ))}
      </ul>
    </>
  );
}
