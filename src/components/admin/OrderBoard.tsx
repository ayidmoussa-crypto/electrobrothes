"use client";

import { ArrowUpRight, GripVertical, Phone, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type DragEvent, type ReactNode } from "react";
import { formatMAD } from "@/lib/money";
import type { OrderStatus } from "@/lib/order-rules";
import { agentMayMove } from "@/lib/staff-rules";
import { Morph, morphName } from "@/components/ui/Morph";
import { useAdminTr } from "./AdminLang";
import { CarrierLogo } from "./CarrierLogo";
import { DeleteOrders } from "./DeleteOrders";
import { STATUS_STYLE, StatusMenu, useStatusMove, WhatsAppConfirm } from "./OrderRowMenus";
import { RowCheck } from "./OrderSelection";
import { statusLabel } from "./ui";

export type BoardOrder = {
  id: string;
  number: string;
  status: OrderStatus;
  total: number;
  customerName: string;
  cityName: string;
  phone: string;
  /** "منذ 6 ساعات", worked out on the server so both renders agree. */
  when: string;
  image: string | null;
  name: string | null;
  variantLabel: string | null;
  colorHex: string | null;
  /** Other lines in the order. */
  more: number;
  waiting: boolean;
  risky: number | null;
  source: string | null;
  waHref: string;
  carrier: { name: string; logoUrl: string | null } | null;
  canDelete: boolean;
};
export type BoardColumn = { status: OrderStatus; count: number; total: number; orders: BoardOrder[]; listHref: string };

/** The road an order travels, one wide column each. */
const FLOW: OrderStatus[] = ["NEW", "CONFIRMED", "SHIPPING", "DELIVERED"];
/** Where an order leaves the road: a narrow lane of drop boxes beside it, so the whole board fits on one screen. */
const EXITS: OrderStatus[] = ["CANCELLED", "RETURNING", "RETURNED"];
/** Lines listed in each exit box; the rest are in the list. */
const EXIT_ROWS = 4;

/**
 * The orders by status on one screen, for desktop. Four columns follow an order from new to delivered; cancelled
 * and returns sit in a lane beside them, always in reach. Drag a card onto a column or a box to move it (the same
 * rules and questions as the status menu), or use the card's move button.
 */
export function OrderBoard({ columns, agent }: { columns: BoardColumn[]; agent: boolean }) {
  const { tr, lang } = useAdminTr();
  const { move, dialog, state, pending } = useStatusMove();
  const [drag, setDrag] = useState<BoardOrder | null>(null);
  const [over, setOver] = useState<OrderStatus | null>(null);
  const col = (s: OrderStatus) => columns.find((c) => c.status === s)!;
  const canDrop = (to: OrderStatus) => !!drag && drag.status !== to && (!agent || agentMayMove(drag.status, to));
  const mad = (v: number) => formatMAD(v, lang);

  const dropZone = (to: OrderStatus) => ({
    onDragOver: (e: DragEvent) => {
      if (!canDrop(to)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== to) setOver(to);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const order = drag;
      setDrag(null);
      setOver(null);
      if (order && canDrop(to)) void move({ orderId: order.id, number: order.number, status: order.status }, to);
    },
  });
  const dragProps = (o: BoardOrder) =>
    !agent || o.status === "NEW"
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", o.number);
            setDrag(o);
          },
          onDragEnd: () => {
            setDrag(null);
            setOver(null);
          },
        }
      : {};
  /** The frame of a drop target: lit while it is the one under the card, outlined while it could take it. */
  const zone = (s: OrderStatus) =>
    over === s
      ? s === "CANCELLED"
        ? "border-danger bg-danger-soft"
        : "border-yellow-500 bg-yellow-50"
      : canDrop(s)
        ? "border-dashed border-yellow-700 bg-warm-100/80"
        : drag
          ? "border-warm-200 bg-warm-100/80 opacity-60"
          : "border-warm-200 bg-warm-100/80";

  const head = (c: BoardColumn, small = false) => (
    <header className={`flex items-start gap-2 px-2 ${small ? "pt-0.5 pb-1.5" : "pt-1 pb-2"}`}>
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${STATUS_STYLE[c.status].dot}`} aria-hidden="true" />
      {/* Name and count on the first line, the money under them, so nothing is cut in a narrow column. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm leading-6 font-extrabold whitespace-nowrap">{statusLabel(c.status, lang)}</h2>
          <span className="rounded-full bg-ink px-2 text-xs leading-5 font-bold text-white tabular-nums">{c.count}</span>
        </div>
        <p className="text-xs font-semibold text-warm-600 tabular-nums">{mad(c.total)}</p>
      </div>
      <Link href={c.listHref} title={tr("شوف الكل", "See all")} aria-label={tr(`كل الطلبات: ${statusLabel(c.status, lang)}`, `All ${statusLabel(c.status, lang)} orders`)} className="grid size-7 shrink-0 place-items-center rounded-full text-warm-700 hover:bg-white hover:text-ink">
        <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      </Link>
    </header>
  );
  const more = (c: BoardColumn, shown: number): ReactNode =>
    c.count > shown ? (
      <Link href={c.listHref} className="flex min-h-9 items-center justify-center rounded-xl text-xs font-bold text-ink hover:bg-white">
        {tr(`+${c.count - shown} طلب آخر`, `+${c.count - shown} more`)}
      </Link>
    ) : null;

  return (
    <div>
      {state.ok === false && state.message ? (
        <p role="alert" className="mb-3 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">
          {state.message}
        </p>
      ) : null}
      {/* Fits a laptop screen; on a narrower one the board scrolls sideways rather than squeezing the cards. */}
      <div className={`overflow-x-auto pb-3 ${pending ? "cursor-progress" : ""}`}>
        <div className="grid min-w-[60rem] grid-cols-[repeat(4,minmax(0,1fr))_minmax(11.5rem,14rem)] items-start gap-3">
          {FLOW.map((s) => {
            const c = col(s);
            return (
              <section key={s} aria-label={statusLabel(s, lang)} {...dropZone(s)} className={`flex min-w-0 flex-col rounded-3xl border p-1.5 transition-colors ${zone(s)}`}>
                {head(c)}
                <ul className="flex max-h-[calc(100dvh-17rem)] min-h-28 flex-col gap-2 overflow-y-auto pb-1">
                  {c.orders.map((o) => (
                    <Card key={o.id} o={o} agent={agent} dragging={drag?.id === o.id} drag={dragProps(o)} />
                  ))}
                  {!c.orders.length ? <li className="grid min-h-24 place-items-center rounded-2xl border border-dashed border-warm-300 text-xs text-warm-500">{tr("ما كاين حتى طلب", "No orders")}</li> : null}
                  {more(c, c.orders.length) ? <li>{more(c, c.orders.length)}</li> : null}
                </ul>
              </section>
            );
          })}

          {/* The exits, stacked: always on screen, so cancelling is one short drag away. */}
          <div className="flex min-w-0 flex-col gap-3">
            {EXITS.map((s) => {
              const c = col(s);
              const rows = c.orders.slice(0, EXIT_ROWS);
              return (
                <section key={s} aria-label={statusLabel(s, lang)} {...dropZone(s)} className={`rounded-3xl border p-1.5 transition-colors ${zone(s)}`}>
                  {head(c, true)}
                  {over === s || canDrop(s) ? (
                    <p className="grid min-h-16 place-items-center rounded-2xl border border-dashed border-current px-2 text-center text-xs font-bold text-warm-700">
                      {tr(`حطّ الطلب هنا: ${statusLabel(s, lang)}`, `Drop here: ${statusLabel(s, lang)}`)}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {rows.map((o) => (
                        <li
                          key={o.id}
                          {...dragProps(o)}
                          className={`flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 text-xs ${dragProps(o).draggable ? "cursor-grab active:cursor-grabbing" : ""} ${drag?.id === o.id ? "opacity-40" : ""}`}
                        >
                          <span className="relative size-7 shrink-0 overflow-hidden rounded-lg border border-warm-200 bg-white">
                            {o.image ? <Image src={o.image} alt="" fill sizes="28px" unoptimized className="object-contain p-0.5" draggable={false} /> : null}
                          </span>
                          <span className="min-w-0 flex-1 leading-tight">
                            <Link href={`/admin/orders/${o.id}`} className="block font-mono font-bold text-ink hover:underline" dir="ltr">
                              {o.number}
                            </Link>
                            <span className="block truncate text-warm-600">{o.customerName}</span>
                          </span>
                          <b className="shrink-0 text-ink tabular-nums">{mad(o.total)}</b>
                        </li>
                      ))}
                      {!rows.length ? <li className="px-2 pb-1 text-xs text-warm-500">{tr("ما كاين حتى طلب", "No orders")}</li> : null}
                      {more(c, rows.length) ? <li>{more(c, rows.length)}</li> : null}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}

/** One order on the board: what to pack and who to call, and the few actions done from here. */
function Card({ o, agent, dragging, drag }: { o: BoardOrder; agent: boolean; dragging: boolean; drag: object }) {
  const { tr, lang } = useAdminTr();
  const movable = "draggable" in drag;
  return (
    <li {...drag} className={`group rounded-2xl border border-warm-200 bg-white p-2.5 shadow-[0_6px_18px_-14px] shadow-ink/40 transition-opacity ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-1.5">
        {agent ? null : <RowCheck id={o.id} number={o.number} />}
        <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-bold whitespace-nowrap text-ink underline-offset-4 hover:underline" dir="ltr">
          {o.number}
        </Link>
        {o.risky !== null ? <ShieldAlert className="size-3.5 shrink-0 text-warning-text" aria-label={tr(`مشبوه ${o.risky}`, `Risk ${o.risky}`)} /> : null}
        <span className="ms-auto shrink-0 text-sm font-extrabold text-ink tabular-nums">{formatMAD(o.total, lang)}</span>
        {movable ? <GripVertical className="-me-1 size-4 shrink-0 text-warm-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" /> : null}
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <span className="relative size-11 shrink-0">
          <Morph source name={morphName.order(o.id)}>
            <span className="absolute inset-0 overflow-hidden rounded-xl border border-warm-200 bg-white">
              {o.image ? <Image src={o.image} alt="" fill sizes="44px" unoptimized className="object-contain p-1" draggable={false} /> : null}
            </span>
          </Morph>
          {o.more ? (
            <span className="absolute -end-1.5 -bottom-1.5 rounded-full border-2 border-white bg-ink px-1.5 text-[10px] leading-4 font-bold text-white">+{o.more}</span>
          ) : o.colorHex ? (
            <span className="absolute -end-1 -bottom-1 size-4 rounded-full border-2 border-white ring-1 ring-warm-300" style={{ backgroundColor: o.colorHex }} title={o.variantLabel ?? undefined} aria-hidden="true" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-bold text-ink" title={[o.name, o.variantLabel].filter(Boolean).join(" · ")}>
            {o.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-warm-600">
            {o.customerName} · {o.cityName}
            {o.source ? ` · ${o.source}` : ""}
          </span>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <StatusMenu compact orderId={o.id} number={o.number} status={o.status} waiting={o.waiting} agent={agent} />
        <a href={`tel:${o.phone}`} aria-label={tr(`عيّط على ${o.customerName}`, `Call ${o.customerName}`)} title={tr("عيّط", "Call")} className="grid size-7 shrink-0 place-items-center rounded-full text-warm-700 hover:bg-warm-100 hover:text-ink">
          <Phone className="size-3.5" aria-hidden="true" />
        </a>
        <WhatsAppConfirm compact orderId={o.id} status={o.status} href={o.waHref} />
        {!agent && o.canDelete ? <DeleteOrders ids={[o.id]} label={o.number} variant="icon" /> : null}
        {o.carrier ? <CarrierLogo name={o.carrier.name} logoUrl={o.carrier.logoUrl} className="size-7" /> : null}
        <span className="ms-auto truncate text-[11px] font-semibold text-warm-500">{o.when}</span>
      </div>
      {o.waiting && o.status === "NEW" ? <p className="mt-1.5 w-fit rounded-full bg-warning-soft px-2 text-[11px] leading-5 font-bold text-warning-text">{tr("فانتظار الرد", "Awaiting reply")}</p> : null}
    </li>
  );
}
