"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { updateOrderInfo } from "@/app/actions/admin-orders";
import { Select } from "@/components/ui/Select";
import { useAdminTr } from "./AdminLang";
import { ActionForm } from "./ActionForm";
import { inputClass, L } from "./ui";

export type EditableOrder = { id: string; customerName: string; phone: string; cityId: string; address: string; notes: string | null };

/** "Edit" button that opens the customer's details as a form, for an order not yet with a carrier. */
export function EditOrderInfo({ order, cities }: { order: EditableOrder; cities: { id: string; name: string }[] }) {
  const { tr } = useAdminTr();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-warm-300 px-4 font-semibold text-ink hover:bg-warm-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
        <Pencil className="size-4" aria-hidden="true" />
        {tr("تعديل المعلومات", "Edit details")}
      </button>
    );
  }
  return (
    <div className="basis-full rounded-xl border border-warm-200 p-4">
      <ActionForm action={updateOrderInfo} submitLabel={tr("حفظ", "Save")} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="orderId" value={order.id} />
        <L label={tr("الاسم", "Name")}>
          <input name="customerName" required minLength={2} maxLength={100} defaultValue={order.customerName} className={inputClass} />
        </L>
        <L label={tr("الهاتف", "Phone")}>
          <input name="phone" required inputMode="tel" dir="ltr" defaultValue={`0${order.phone.slice(4)}`} className={inputClass} />
        </L>
        <L label={tr("المدينة", "City")}>
          <Select name="cityId" required defaultValue={order.cityId} className={inputClass}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </L>
        <L label={tr("العنوان", "Address")}>
          <input name="address" required minLength={3} maxLength={300} defaultValue={order.address} className={inputClass} />
        </L>
        <L label={tr("ملاحظات", "Notes")} className="sm:col-span-2">
          <textarea name="notes" maxLength={500} rows={2} defaultValue={order.notes ?? ""} className={inputClass} />
        </L>
      </ActionForm>
      <button type="button" onClick={() => setOpen(false)} className="mt-2 text-sm text-warm-600 hover:text-ink">
        {tr("سد", "Close")}
      </button>
    </div>
  );
}
