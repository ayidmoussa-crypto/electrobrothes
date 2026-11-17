"use client";

import { MessageCircle, Star } from "lucide-react";
import { useActionState, useTransition } from "react";
import { markConfirmSent, markReviewAsked, setOrderStatus, setPrepaid, type ActionState } from "@/app/actions/admin-orders";
import { whatsappKind } from "@/lib/reviews/ask";
import { allowedNext, canSetPrepaid, deliveredByHand, holdsStock, ORDER_STATUSES, paymentState, undoesDelivery, type OrderStatus } from "@/lib/order-rules";
import { useConfirm } from "./ConfirmDialog";
import { PillMenu, type PillOption } from "./PillMenu";
import { statusLabel } from "./ui";
import { useAdminTr } from "./AdminLang";
import type { Tr } from "@/lib/admin-tr";
import { agentMayMove } from "@/lib/staff-rules";

// Same soft background + strong text pairs as the badges (all ≥4.5:1); the dot repeats it in the menu.
export const STATUS_STYLE: Record<OrderStatus, { tone: string; dot: string }> = {
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
const WAITING = { label: ["فانتظار الرد", "Awaiting reply"], tone: "bg-warning-soft text-warning-text", dot: "bg-warning" } as const;

const PAYMENT = {
  PENDING: { label: ["في الانتظار", "Pending"], tone: "bg-warning-soft text-warning-text", dot: "bg-warning" },
  PREPAID: { label: ["مدفوع مسبقاً", "Prepaid"], tone: "bg-success-soft text-success", dot: "bg-success" },
  PAID: { label: ["مدفوع", "Paid"], tone: "bg-success-soft text-success", dot: "bg-success" },
  NONE: { label: ["غير مدفوع", "Unpaid"], tone: "bg-warm-100 text-warm-600", dot: "bg-warm-400" },
} as const;

/** What a hand-picked change does, told before it is done. */
function changeEffects(from: OrderStatus, to: OrderStatus, tr: Tr) {
  const out: string[] = [];
  if (deliveredByHand(from, to)) out.push(tr("سلّمتها بيدك: بلا رسوم توصيل، والفلوس كتتحسب عندك.", "Delivered by hand: no delivery fee, and the money counts as yours."));
  if (undoesDelivery(from, to)) out.push(tr("التسليم والفلوس ديالو كيتمسحو من المالية.", "The delivery and its money are removed from finance."));
  if (holdsStock(from) && !holdsStock(to)) out.push(tr("السلعة كترجع للمخزون.", "The goods go back to stock."));
  if (!holdsStock(from) && holdsStock(to)) out.push(tr("السلعة كتنقص من المخزون.", "The goods come off the stock."));
  return out;
}

function Message({ state }: { state: ActionState }) {
  return state.ok === false && state.message ? (
    <p role="alert" className="mt-1 max-w-48 text-xs font-semibold text-danger">
      {state.message}
    </p>
  ) : null;
}

/**
 * Moves an order to another status, asking first (with what will happen) when it undoes a sale or leaves the
 * usual path. Shared by the status menu and the board's drag and drop.
 */
export function useStatusMove() {
  const [state, action, pending] = useActionState<ActionState, FormData>(setOrderStatus, {});
  const [, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  const { tr } = useAdminTr();
  const move = async (order: { orderId: string; number: string; status: OrderStatus }, to: OrderStatus) => {
    const { orderId, number, status } = order;
    if (to === status) return;
    if (ASK_FIRST.includes(to) || !allowedNext(status).includes(to)) {
      const effects = changeEffects(status, to, tr);
      const ok = await confirm({
        title: tr(`${statusLabel(status)} ← ${statusLabel(to)}`, `${statusLabel(status, "en")} → ${statusLabel(to, "en")}`),
        yes: tr(`نعم، ${statusLabel(to)}`, `Yes, ${statusLabel(to, "en")}`),
        detail: (
          <>
            <p>{tr(`الطلب ${number}.`, `Order ${number}.`)}</p>
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
  };
  return { move, dialog, state, pending };
}

/** Change the status right from the list; cancelling or a return asks first. */
export function StatusMenu({
  orderId,
  status,
  number,
  waiting = false,
  agent = false,
  compact = false,
  wide = false,
}: {
  orderId: string;
  status: OrderStatus;
  number: string;
  waiting?: boolean;
  agent?: boolean;
  /** A small round "move to…" button, for a board card whose column already names the status. */
  compact?: boolean;
  /** Fills the width it is given (a phone card), instead of the list's fixed width. */
  wide?: boolean;
}) {
  const { move, dialog, state, pending } = useStatusMove();
  const { tr, lang } = useAdminTr();
  const label = waiting && status === "NEW" ? { ...WAITING, label: tr(...WAITING.label) } : { label: statusLabel(status, lang), ...STATUS_STYLE[status] };
  // An agent answers new orders only; past that the status is just shown.
  if (agent && status !== "NEW") {
    return compact ? null : (
      <span className={`inline-flex ${wide ? "min-h-10 w-full" : "min-h-8 w-28"} items-center gap-1.5 rounded-full px-2.5 text-xs font-bold ${label.tone}`}>
        <span className={`size-2 shrink-0 rounded-full ${label.dot}`} aria-hidden="true" />
        {label.label}
      </span>
    );
  }
  // Every status in its usual order, all open: by hand the owner may jump anywhere (he sometimes
  // delivers an order himself). Stock follows on its own. An agent gets confirm or cancel.
  const options: PillOption[] = ORDER_STATUSES.filter((s) => !agent || s === status || agentMayMove(status, s)).map((s) => ({
    value: s,
    label: s === status ? label.label : statusLabel(s, lang),
    dot: STATUS_STYLE[s].dot,
    danger: s === "CANCELLED",
  }));

  return (
    <div className={wide ? "min-w-0 flex-1" : undefined}>
      <PillMenu
        label={compact ? tr(`نقل الطلب ${number}`, `Move order ${number}`) : tr(`حالة الطلب ${number}`, `Status of order ${number}`)}
        current={{ value: status, label: label.label, dot: label.dot }}
        tone={compact ? "bg-warm-100 text-warm-800" : label.tone}
        compact={compact}
        // One width for every status, so the WhatsApp buttons next to them line up in the list.
        className={compact ? "" : wide ? "min-h-10! w-full justify-between px-3.5! text-sm!" : "w-28 justify-between"}
        options={options}
        pending={pending}
        onPick={(to) => move({ orderId, number, status }, to as OrderStatus)}
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
  const { tr } = useAdminTr();
  const p = PAYMENT[paymentState(status, prepaid)];
  const pLabel = tr(p.label[0], p.label[1]);
  const note = status === "DELIVERED" && !prepaid ? (collected ? tr("تحصّل", "Collected") : tr("عند شركة التوصيل", "With the carrier")) : prepaid ? tr("التوصيل يجمع 0 د.م.", "Carrier collects MAD 0") : null;
  const choices: PillOption[] = [
    { value: "0", label: tr(...PAYMENT.PENDING.label), dot: PAYMENT.PENDING.dot },
    { value: "1", label: tr(...PAYMENT.PREPAID.label), dot: PAYMENT.PREPAID.dot },
  ];
  const current = prepaid ? "1" : "0";

  return (
    <div>
      {canSetPrepaid(status) ? (
        <PillMenu
          label={tr(`الدفع ديال الطلب ${number}`, `Payment of order ${number}`)}
          current={{ value: current, label: pLabel, dot: p.dot }}
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
        <span className={`inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-bold ${p.tone}`}>{pLabel}</span>
      )}
      {note ? <span className="mt-1 block text-xs text-warm-600">{note}</span> : null}
      <Message state={state} />
    </div>
  );
}

/**
 * Opens WhatsApp with the message ready to send (sending stays by hand), chosen by the order's status (`href` is
 * built to match, lib/order-whatsapp-href.ts). New, confirmed and the rest: the confirmation; a new order then shows
 * "waiting for the reply". Delivered: the review request, with a star, and the order leaves the to-ask list.
 */
export function WhatsAppConfirm({
  orderId,
  href,
  status,
  compact = false,
  panel = false,
}: {
  orderId: string;
  href: string;
  status: OrderStatus;
  compact?: boolean;
  /** The big button revealed by swiping a phone card aside. */
  panel?: boolean;
}) {
  const [, start] = useTransition();
  const { tr } = useAdminTr();
  const review = whatsappKind(status) === "review";
  const label = review ? tr("رسالة طلب التقييم فواتساب", "Review request on WhatsApp") : tr("رسالة التأكيد فواتساب", "Confirmation message on WhatsApp");
  const Icon = review ? Star : MessageCircle;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        if (status === "NEW") start(() => markConfirmSent(orderId));
        if (review) start(() => markReviewAsked(orderId));
      }}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      className={
        panel
          ? "flex w-28 shrink-0 snap-end flex-col items-center justify-center gap-1.5 rounded-[1.75rem] bg-whatsapp font-bold text-ink"
          : compact
          ? "grid size-8 shrink-0 place-items-center rounded-full bg-whatsapp text-ink transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
          : "inline-flex min-h-11 items-center gap-2 rounded-lg bg-whatsapp px-4 font-semibold text-ink hover:opacity-90"
      }
    >
      <Icon className={panel ? "size-6" : "size-4"} aria-hidden="true" />
      {panel ? (review ? tr("التقييم", "Review") : tr("واتساب", "WhatsApp")) : compact ? null : review ? tr("طلب التقييم فواتساب", "Ask for a review on WhatsApp") : tr("تأكيد عبر واتساب", "Confirm on WhatsApp")}
    </a>
  );
}
