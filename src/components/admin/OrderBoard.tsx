"use client";

import { ArrowUpRight, Phone, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type DragEvent } from "react";
import { formatMAD } from "@/lib/money";
import type { OrderStatus } from "@/lib/order-rules";
import { agentMayMove } from "@/lib/staff-rules";
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

/**
 * The orders as columns by status, for desktop: drag a card to another column to move it (the same rules and
 * questions as the status menu), or use the menu on the card. Each column shows its latest orders, its count and
 * its money; "see all" opens the list filtered on it.
 */
export function OrderBoard({ columns, agent }: { columns: BoardColumn[]; agent: boolean }) {
  const { tr, lang } = useAdminTr();
  const { move, dialog, state, pending } = useStatusMove();
  const [drag, setDrag] = useState<BoardOrder | null>(null);
  const [over, setOver] = useState<OrderStatus | null>(null);
  const canDrop = (to: OrderStatus) => !!drag && drag.status !== to && (!agent || agentMayMove(drag.status, to));
  const mad = (v: number) => formatMAD(v, lang);

  const dropProps = (to: OrderStatus) => ({
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

  return (
    <div>
      {state.ok === false && state.message ? (
        <p role="alert" className="mb-3 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">
          {state.message}
        </p>
      ) : null}
      <div className={`flex items-start gap-3 overflow-x-auto pb-4 ${pending ? "cursor-progress" : ""}`}>
        {columns.map((col) => {
          const target = canDrop(col.status);
          return (
            <section
              key={col.status}
              aria-label={statusLabel(col.status, lang)}
              {...dropProps(col.status)}
              className={`flex w-[19rem] shrink-0 flex-col rounded-3xl border p-2 transition-colors ${
                over === col.status ? "border-yellow-500 bg-yellow-50" : target ? "border-dashed border-yellow-700 bg-warm-100/80" : "border-warm-200 bg-warm-100/80"
              } ${drag && !target && drag.status !== col.status ? "opacity-60" : ""}`}
            >
              <header className="flex items-center gap-2 px-2 pt-1 pb-2">
                <span className={`size-2.5 shrink-0 rounded-full ${STATUS_STYLE[col.status].dot}`} aria-hidden="true" />
                <h2 className="truncate text-sm font-extrabold">{statusLabel(col.status, lang)}</h2>
                <span className="rounded-full bg-ink px-2 text-xs leading-5 font-bold text-white tabular-nums">{col.count}</span>
                <span className="truncate text-xs font-semibold text-warm-600 tabular-nums">{mad(col.total)}</span>
                <Link href={col.listHref} title={tr("شوف الكل", "See all")} aria-label={tr(`كل الطلبات: ${statusLabel(col.status, lang)}`, `All ${statusLabel(col.status, lang)} orders`)} className="ms-auto grid size-8 shrink-0 place-items-center rounded-full text-warm-700 hover:bg-white hover:text-ink">
                  <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </header>

              <ul className="flex max-h-[calc(100dvh-17rem)] min-h-24 flex-col gap-2 overflow-y-auto px-0.5 pb-1">
                {col.orders.map((o) => {
                  const movable = !agent || o.status === "NEW";
                  return (
                    <li
                      key={o.id}
                      draggable={movable}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", o.number);
                        setDrag(o);
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setOver(null);
                      }}
                      className={`rounded-2xl border border-warm-200 bg-white p-3 shadow-[0_6px_18px_-14px] shadow-ink/40 transition-opacity ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${drag?.id === o.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {agent ? null : <RowCheck id={o.id} number={o.number} />}
                        <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm font-bold text-ink underline-offset-4 hover:underline" dir="ltr">
                          {o.number}
                        </Link>
                        {o.risky !== null ? (
                          <span title={tr(`مشبوه ${o.risky}`, `Risk ${o.risky}`)} className="text-warning-text">
                            <ShieldAlert className="size-4" aria-label={tr(`مشبوه ${o.risky}`, `Risk ${o.risky}`)} />
                          </span>
                        ) : null}
                        <span className="ms-auto text-sm font-extrabold text-ink tabular-nums">{mad(o.total)}</span>
                      </div>

                      <div className="mt-2.5 flex items-center gap-3">
                        <span className="relative size-12 shrink-0">
                          <span className="absolute inset-0 overflow-hidden rounded-xl border border-warm-200 bg-white">
                            {o.image ? <Image src={o.image} alt="" fill sizes="48px" unoptimized className="object-contain p-1" draggable={false} /> : null}
                          </span>
                          {o.more ? <span className="absolute -end-1.5 -bottom-1.5 rounded-full border-2 border-white bg-ink px-1.5 text-[10px] leading-4 font-bold text-white">+{o.more}</span> : null}
                          {!o.more && o.colorHex ? (
                            <span className="absolute -end-1 -bottom-1 size-4 rounded-full border-2 border-white ring-1 ring-warm-300" style={{ backgroundColor: o.colorHex }} title={o.variantLabel ?? undefined} aria-hidden="true" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-sm font-bold text-ink" title={o.name ?? undefined}>
                            {o.name}
                            {o.variantLabel ? <span className="font-semibold text-warm-600"> · {o.variantLabel}</span> : null}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-warm-600">
                            {o.customerName} · {o.cityName}
                          </span>
                          {o.source ? <span className="mt-1 inline-block rounded-full bg-warm-100 px-2 text-[11px] leading-5 font-semibold text-warm-700">{o.source}</span> : null}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-1">
                        <StatusMenu orderId={o.id} number={o.number} status={o.status} waiting={o.waiting} agent={agent} />
                        <a href={`tel:${o.phone}`} aria-label={tr(`عيّط على ${o.customerName}`, `Call ${o.customerName}`)} title={tr("عيّط", "Call")} className="grid size-8 shrink-0 place-items-center rounded-full text-warm-700 hover:bg-warm-100 hover:text-ink">
                          <Phone className="size-4" aria-hidden="true" />
                        </a>
                        <WhatsAppConfirm compact orderId={o.id} status={o.status} href={o.waHref} />
                        {o.carrier ? <CarrierLogo name={o.carrier.name} logoUrl={o.carrier.logoUrl} className="size-8" /> : null}
                        {!agent && o.canDelete ? <DeleteOrders ids={[o.id]} label={o.number} variant="icon" /> : null}
                        <span className="ms-auto shrink-0 text-[11px] font-semibold text-warm-500">{o.when}</span>
                      </div>
                    </li>
                  );
                })}
                {!col.orders.length ? <li className="grid min-h-20 place-items-center rounded-2xl border border-dashed border-warm-300 text-xs text-warm-500">{tr("ما كاين حتى طلب", "No orders")}</li> : null}
                {col.count > col.orders.length ? (
                  <li>
                    <Link href={col.listHref} className="flex min-h-10 items-center justify-center rounded-xl text-xs font-bold text-ink hover:bg-white">
                      {tr(`+${col.count - col.orders.length} طلب آخر`, `+${col.count - col.orders.length} more`)}
                    </Link>
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
      {dialog}
    </div>
  );
}
