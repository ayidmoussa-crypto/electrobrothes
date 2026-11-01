"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { setOrderStatus, type ActionState } from "@/app/actions/admin-orders";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";
import { FormMessage } from "./ui";

export type StatusOption = { to: string; label: string; variant: ButtonVariant };

/**
 * One form, one button per allowed next status. Errors (e.g. not enough stock to confirm)
 * are shown right next to the buttons instead of failing silently.
 */
export function StatusButtons({ orderId, options, withNote = false }: { orderId: string; options: StatusOption[]; withNote?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setOrderStatus, {});
  if (!options.length) return null;

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      {withNote ? (
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
          ملاحظة (اختياري)
          <textarea name="note" rows={2} maxLength={500} className="rounded-lg border border-warm-200 bg-warm-100 px-3 py-2 text-base font-normal text-warm-800 focus:bg-white" />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.to}
            type="submit"
            name="to"
            value={o.to}
            disabled={pending}
            className={buttonClass({ variant: o.variant, className: withNote ? "" : "min-h-9 px-3 text-sm" })}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {o.label}
          </button>
        ))}
      </div>
      <FormMessage state={state} />
    </form>
  );
}
