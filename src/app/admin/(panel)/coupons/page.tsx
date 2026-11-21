import { DateField } from "@/components/ui/DateField";
import { Select } from "@/components/ui/Select";
import { deleteCoupon, saveCoupon } from "@/app/actions/admin-catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { Pagination, pageHref } from "@/components/admin/Pagination";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { adminTr, type AdminLang, type Tr } from "@/lib/admin-lang";
import { clampPage, parsePage } from "@/lib/pagination";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { toMoroccanInput } from "@/lib/time";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("الكوبونات", "Coupons");

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

const PAGE = 15;

function CouponFields({ c, tr, lang }: { c: Coupon; tr: Tr; lang: AdminLang }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
      {c.id ? <input type="hidden" name="id" value={c.id} /> : null}
      <L label={tr("الكود", "Code")}>
        <input name="code" defaultValue={c.code} required dir="ltr" className={`${inputClass} uppercase`} />
      </L>
      <L label={tr("النوع", "Type")}>
        <Select name="type" defaultValue={c.type} className={inputClass}>
          <option value="PERCENT">{tr("نسبة %", "Percent %")}</option>
          <option value="FIXED">{tr("مبلغ ثابت (درهم)", "Fixed amount (MAD)")}</option>
        </Select>
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
        <DateField name="startsAt" defaultValue={day(c.startsAt)} className={inputClass} lang={lang} />
      </L>
      <L label={tr("ينتهي في", "Ends on")}>
        <DateField name="expiresAt" defaultValue={day(c.expiresAt)} className={inputClass} lang={lang} />
      </L>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm text-warm-800">
        <input type="checkbox" name="isActive" defaultChecked={c.isActive} className="size-5 accent-ink" />
        {tr("مفعّل", "Active")}
      </label>
    </div>
  );
}

export default async function CouponsPage({ searchParams }: PageProps<"/admin/coupons">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const total = await db.coupon.count();
  const page = clampPage(parsePage((await searchParams).page), total, PAGE);
  const coupons = await db.coupon.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PAGE, take: PAGE });

  return (
    <>
      <PageHeader title={tr("كوبونات الخصم", "Discount coupons")} description={tr("النسبة المئوية محدودة في 90% كحد أقصى.", "A percentage is capped at 90%.")} />
      <Panel title={tr("كوبون جديد", "New coupon")} className="mb-4">
        <ActionForm action={saveCoupon} submitLabel={tr("إضافة", "Add")}>
          <CouponFields tr={tr} lang={lang} c={{ code: "", type: "PERCENT", value: 10, minSubtotal: null, maxUses: null, startsAt: null, expiresAt: null, isActive: true }} />
        </ActionForm>
      </Panel>
      <ul className="flex flex-col gap-3">
        {coupons.map((c) => (
          <li key={c.id} className="admin-card p-4">
            <p className="mb-2 text-sm text-warm-600">
              {tr("استُعمل", "Used")} <b className="text-ink">{c.usedCount}</b> {c.maxUses ? tr(`من ${c.maxUses}`, `of ${c.maxUses}`) : tr("مرة", "times")}
            </p>
            <ActionForm action={saveCoupon} submitLabel={tr("حفظ", "Save")} variant="outline">
              <CouponFields tr={tr} lang={lang} c={c} />
            </ActionForm>
            <ActionForm action={deleteCoupon} submitLabel={tr("حذف", "Delete")} variant="ghost" className="mt-2" confirm={tr(`حذف الكوبون ${c.code}؟`, `Delete coupon ${c.code}?`)}>
              <input type="hidden" name="id" value={c.id} />
            </ActionForm>
          </li>
        ))}
      </ul>
      <Pagination page={page} total={total} size={PAGE} href={(n) => pageHref("/admin/coupons", {}, n)} tr={tr} />
    </>
  );
}
