"use client";

import { LoaderCircle, Pencil } from "lucide-react";
import { useActionState, useState } from "react";
import { updateOrderItems, type ActionState } from "@/app/actions/admin-orders";
import { buttonClass } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/forms";
import { manualTotals } from "@/lib/manual-order";
import { formatMAD } from "@/lib/money";
import { useAdminTr } from "./AdminLang";
import { OrderLinesPicker, type OrderLine, type PickVariant } from "./OrderLinesPicker";
import { FormMessage, inputClass, L } from "./ui";

/**
 * "Change products" on an order not yet with a carrier: lines, colours, quantities, agreed prices, discount and
 * delivery fee. `held`: what a confirmed order already took from the stock, usable again for its own lines.
 */
export function EditOrderItems({
  orderId,
  variants,
  lines: initial,
  held,
  shippingFee,
  discount: initialDiscount,
}: {
  orderId: string;
  variants: PickVariant[];
  lines: OrderLine[];
  held: Record<string, number>;
  shippingFee: number;
  discount: number;
}) {
  const { tr, lang } = useAdminTr();
  const mad = (v: number) => formatMAD(v, lang);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(updateOrderItems, {});
  const [lines, setLines] = useState(initial);
  const [discount, setDiscount] = useState(initialDiscount);
  const [shipping, setShipping] = useState(shippingFee);
  const num = (s: string) => Math.max(0, Math.floor(Number(s) || 0));
  const totals = manualTotals(lines, shipping, discount);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-warm-300 px-4 font-semibold text-ink hover:bg-warm-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
        <Pencil className="size-4" aria-hidden="true" />
        {tr("تعديل المنتجات", "Edit products")}
      </button>
    );
  }
  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="mt-4 rounded-xl border border-warm-200 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      <OrderLinesPicker variants={variants} lines={lines} onChange={setLines} held={held} />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-warm-200 pt-4">
        <L label={tr("الخصم (درهم)", "Discount (MAD)")}>
          <input name="discount" type="number" min={0} value={discount} onChange={(e) => setDiscount(num(e.target.value))} className={inputClass} />
        </L>
        <L label={tr("التوصيل (درهم)", "Delivery (MAD)")}>
          <input name="shippingFee" type="number" min={0} value={shipping} onChange={(e) => setShipping(num(e.target.value))} className={inputClass} />
        </L>
      </div>
      <dl className="mt-3 flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-warm-600">{tr("المجموع الفرعي", "Subtotal")}</dt>
          <dd>{mad(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-base">
          <dt className="font-bold text-ink">{tr("المبلغ الجديد", "New total")}</dt>
          <dd className="font-extrabold text-ink">{totals.total === null ? "—" : mad(totals.total)}</dd>
        </div>
      </dl>
      {totals.total === null ? <p className="mt-2 text-sm font-medium text-danger">{tr("الخصم أكبر من ثمن المنتجات.", "The discount is larger than the products' price.")}</p> : null}
      {Object.keys(held).length ? <p className="mt-2 text-xs text-warm-600">{tr("الطلب مؤكَّد: القطع اللي زدتي كتنقص من المخزون، واللي حيدتي كترجع ليه.", "The order is confirmed: pieces you add come off the stock, and pieces you remove go back.")}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !lines.length || totals.total === null} className={buttonClass({})}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {tr("حفظ المنتجات", "Save products")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-warm-600 hover:text-ink">
          {tr("سد", "Close")}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
