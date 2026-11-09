"use client";

import { MessageCircle } from "lucide-react";
import { useActionState, useTransition } from "react";
import { markConfirmSent, setOrderStatus, setPrepaid, type ActionState } from "@/app/actions/admin-orders";
import { allowedNext, canSetPrepaid, deliveredByHand, holdsStock, ORDER_STATUSES, paymentState, undoesDelivery, type OrderStatus } from "@/lib/order-rules";
import { useConfirm } from "./ConfirmDialog";
import { PillMenu, type PillOption } from "./PillMenu";
import { STATUS_LABEL } from "./ui";

// Same soft background + strong text pairs as the badges (all ≥4.5:1); the dot repeats it in the menu.
const STATUS_STYLE: Record<OrderStatus, { tone: string; dot: string }> = {
  NEW: { tone: "bg-yellow-100 text-yellow-900", dot: "bg-yellow-500" },
  CONFIRMED: { tone: "bg-warm-100 text-warm-800", dot: "bg-warm-600" },
  CANCELLED: { tone: "bg-danger-soft text-danger", dot: "bg-danger" },
  SHIPPING: { tone: "bg-ink text-white", dot: "bg-ink" },
  DELIVERED: { tone: "bg-success-soft text-success", dot: "bg-success" },
  RETURNING: { tone: "bg-warning-soft text-warning-text", dot: "bg-warning" },
  RETURNED: { tone: "bg-warm-200 text-warm-800", dot: "bg-warm-500" },
};
// Steps that undo a sale: asked twice.
const ASK_FIRST: OrderStatus[] = ["CANCELLED", "RETURNING", "RETURNED"];
// A new order whose confirmation message went out on WhatsApp: still NEW, waiting for the reply.
const WAITING = { label: "فانتظار الرد", tone: "bg-warning-soft text-warning-text", dot: "bg-warning" };

const PAYMENT = {
  PENDING: { label: "في الانتظار", tone: "bg-warning-soft text-warning-text", dot: "bg-warning" },
  PREPAID: { label: "مدفوع مسبقاً", tone: "bg-success-soft text-success", dot: "bg-success" },
  PAID: { label: "مدفوع", tone: "bg-success-soft text-success", dot: "bg-success" },
  NONE: { label: "غير مدفوع", tone: "bg-warm-100 text-warm-600", dot: "bg-warm-400" },
} as const;

/** What a hand-picked change does, told before it is done. */
function changeEffects(from: OrderStatus, to: OrderStatus) {
  const out: string[] = [];
  if (deliveredByHand(from, to)) out.push("سلّمتها بيدك: بلا رسوم توصيل، والفلوس كتتحسب عندك.");
  if (undoesDelivery(from, to)) out.push("التسليم والفلوس ديالو كيتمسحو من المالية.");
  if (holdsStock(from) && !holdsStock(to)) out.push("السلعة كترجع للمخزون.");
  if (!holdsStock(from) && holdsStock(to)) out.push("السلعة كتنقص من المخزون.");
  return out;
}

function Message({ state }: { state: ActionState }) {
  return state.ok === false && state.message ? (
    <p role="alert" className="mt-1 max-w-48 text-xs font-semibold text-danger">
      {state.message}
    </p>
  ) : null;
}

/** Change the status right from the list; cancelling or a return asks first. */
export function StatusMenu({ orderId, status, number, waiting = false }: { orderId: string; status: OrderStatus; number: string; waiting?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setOrderStatus, {});
  const [, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  const label = waiting && status === "NEW" ? WAITING : { label: STATUS_LABEL[status], ...STATUS_STYLE[status] };
  // Every status in its usual order, all open: by hand the owner may jump anywhere (he sometimes
  // delivers an order himself). Stock follows on its own.
  const options: PillOption[] = ORDER_STATUSES.map((s) => ({
    value: s,
    label: s === status ? label.label : STATUS_LABEL[s],
    dot: STATUS_STYLE[s].dot,
    danger: s === "CANCELLED",
  }));

  return (
    <div>
      <PillMenu
        label={`حالة الطلب ${number}`}
        current={{ value: status, label: label.label, dot: label.dot }}
        tone={label.tone}
        // One width for every status, so the WhatsApp buttons next to them line up in the list.
        className="w-28 justify-between"
        options={options}
        pending={pending}
        onPick={async (to) => {
          const s = to as OrderStatus;
          // Off the usual path (or undoing a sale): asked first, with what will happen.
          if (ASK_FIRST.includes(s) || !allowedNext(status).includes(s)) {
            const effects = changeEffects(status, s);
            const ok = await confirm({
              title: `${STATUS_LABEL[status]} ← ${STATUS_LABEL[s]}`,
              yes: `نعم، ${STATUS_LABEL[s]}`,
              detail: (
                <>
                  <p>الطلب {number}.</p>
                  {effects.length ? (
                    <ul className="mt-2 list-disc ps-5">
                      {effects.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ),
            });
            if (!ok) return;
          }
          const fd = new FormData();
          fd.set("orderId", orderId);
          fd.set("to", to);
          start(() => action(fd));
        }}
      />
      {dialog}
      <Message state={state} />
    </div>
  );
}

/**
 * Payment follows the status (delivered = paid). By hand only "paid before shipping", which tells the
 * carrier to collect 0 MAD, while the parcel has not left for good.
 */
export function PaymentMenu({ orderId, status, prepaid, collected, number }: { orderId: string; status: OrderStatus; prepaid: boolean; collected: boolean; number: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setPrepaid, {});
  const [, start] = useTransition();
  const p = PAYMENT[paymentState(status, prepaid)];
  const note = status === "DELIVERED" && !prepaid ? (collected ? "تحصّل" : "عند شركة التوصيل") : prepaid ? "التوصيل يجمع 0 د.م." : null;
  const choices: PillOption[] = [
    { value: "0", label: PAYMENT.PENDING.label, dot: PAYMENT.PENDING.dot },
    { value: "1", label: PAYMENT.PREPAID.label, dot: PAYMENT.PREPAID.dot },
  ];
  const current = prepaid ? "1" : "0";

  return (
    <div>
      {canSetPrepaid(status) ? (
        <PillMenu
          label={`الدفع ديال الطلب ${number}`}
          current={{ value: current, label: p.label, dot: p.dot }}
          tone={p.tone}
          options={choices}
          pending={pending}
          onPick={(paid) => {
            const fd = new FormData();
            fd.set("orderId", orderId);
            fd.set("paid", paid);
            start(() => action(fd));
          }}
        />
      ) : (
        <span className={`inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-bold ${p.tone}`}>{p.label}</span>
      )}
      {note ? <span className="mt-1 block text-xs text-warm-600">{note}</span> : null}
      <Message state={state} />
    </div>
  );
}

/**
 * Opens WhatsApp with the confirmation message ready to send (sending stays by hand). A new order then
 * shows "waiting for the reply" until the owner confirms it.
 */
export function WhatsAppConfirm({ orderId, href, status, compact = false }: { orderId: string; href: string; status: OrderStatus; compact?: boolean }) {
  const [, start] = useTransition();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        if (status === "NEW") start(() => markConfirmSent(orderId));
      }}
      aria-label={compact ? "رسالة التأكيد فواتساب" : undefined}
      title={compact ? "رسالة التأكيد فواتساب" : undefined}
      className={
        compact
          ? "grid size-8 shrink-0 place-items-center rounded-full bg-whatsapp text-ink transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
          : "inline-flex min-h-11 items-center gap-2 rounded-lg bg-whatsapp px-4 font-semibold text-ink hover:opacity-90"
      }
    >
      <MessageCircle className="size-4" aria-hidden="true" />
      {compact ? null : "تأكيد عبر واتساب"}
    </a>
  );
}
