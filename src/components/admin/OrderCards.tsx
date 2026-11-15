"use client";

import { Phone, Plus, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatMAD } from "@/lib/money";
import { useAdminTr } from "./AdminLang";
import { DeleteOrders } from "./DeleteOrders";
import type { BoardOrder } from "./OrderBoard";
import { StatusMenu, WhatsAppConfirm } from "./OrderRowMenus";

/**
 * The orders on a phone: a heading per day, then one card per order with what to pack and who to call, the status
 * to change, and call / WhatsApp / delete. Swiping a card aside shows a big WhatsApp button. A round "+" adds an order.
 */
export function OrderCards({ days, agent }: { days: { key: string; label: string; orders: BoardOrder[] }[]; agent: boolean }) {
  const { tr, lang } = useAdminTr();

  return (
    <>
      {days.length ? (
        days.map((day) => (
          <section key={day.key} aria-label={day.label} className="mb-6">
            <header className="mb-3 flex items-center gap-2.5 px-1">
              <span className="size-2.5 rounded-full bg-yellow-500" aria-hidden="true" />
              <h2 className="text-lg">{day.label}</h2>
              <span className="ms-auto text-sm text-warm-600">{tr(`${day.orders.length} طلب`, `${day.orders.length} orders`)}</span>
            </header>
            <ul className="flex flex-col gap-3">
              {day.orders.map((o) => (
                <li key={o.id}>
                  {/* The card and its WhatsApp button side by side in a row that snaps: swipe to reveal it. */}
                  <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <article className="w-full shrink-0 snap-start rounded-[1.75rem] border border-warm-200/80 bg-white p-3.5 shadow-[0_8px_24px_-18px] shadow-ink/40">
                      <div className="flex gap-3">
                        <Link href={`/admin/orders/${o.id}`} className="relative size-20 shrink-0" aria-label={tr(`فتح الطلب ${o.number}`, `Open order ${o.number}`)}>
                          <span className="absolute inset-0 overflow-hidden rounded-2xl bg-white">
                            {o.image ? <Image src={o.image} alt="" fill sizes="80px" unoptimized className="object-contain p-1" /> : null}
                          </span>
                          {o.more ? (
                            <span className="absolute -end-1 -bottom-1 rounded-full border-2 border-white bg-ink px-1.5 text-[11px] leading-4 font-bold text-white">+{o.more}</span>
                          ) : o.colorHex ? (
                            <span className="absolute -end-0.5 -bottom-0.5 size-5 rounded-full border-2 border-white ring-1 ring-warm-300" style={{ backgroundColor: o.colorHex }} title={o.variantLabel ?? undefined} aria-hidden="true" />
                          ) : null}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <p className="flex min-w-0 items-center gap-1 text-[13px] font-semibold text-warm-600">
                              <span dir="ltr" className="font-mono">
                                {o.number}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{o.when}</span>
                              {o.risky !== null ? <ShieldAlert className="size-3.5 shrink-0 text-warning-text" aria-label={tr(`مشبوه ${o.risky}`, `Risk ${o.risky}`)} /> : null}
                            </p>
                            <p className="ms-auto shrink-0 text-lg leading-tight font-extrabold text-ink tabular-nums">{formatMAD(o.total, lang)}</p>
                          </div>
                          <Link href={`/admin/orders/${o.id}`} className="mt-0.5 block truncate text-base font-bold text-ink">
                            {o.name ?? o.number}
                            {o.variantLabel ? <span className="font-semibold text-warm-600"> · {o.variantLabel}</span> : null}
                          </Link>
                          <p className="truncate text-sm text-warm-600">
                            {o.customerName} · {o.cityName}
                            {o.source ? ` · ${o.source}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <StatusMenu wide orderId={o.id} number={o.number} status={o.status} waiting={o.waiting} agent={agent} />
                        <a href={`tel:${o.phone}`} aria-label={tr(`عيّط على ${o.customerName}`, `Call ${o.customerName}`)} className="grid size-10 shrink-0 place-items-center rounded-full bg-warm-100 text-ink transition-colors hover:bg-warm-200">
                          <Phone className="size-4.5" aria-hidden="true" />
                        </a>
                        <span className="[&>a]:size-10!">
                          <WhatsAppConfirm compact orderId={o.id} status={o.status} href={o.waHref} />
                        </span>
                        {!agent && o.canDelete ? (
                          <span className="[&>button]:size-10! [&>button]:bg-danger-soft [&>button]:text-danger">
                            <DeleteOrders ids={[o.id]} label={o.number} variant="icon" />
                          </span>
                        ) : null}
                      </div>
                    </article>

                    <WhatsAppConfirm panel orderId={o.id} status={o.status} href={o.waHref} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="admin-card px-4 py-10 text-center text-warm-600">{tr("لا توجد طلبات مطابقة.", "No matching orders.")}</p>
      )}

      {/* Above the bottom bar, out of the way of the thumb's scrolling. */}
      <Link href="/admin/orders/new" aria-label={tr("إضافة طلب", "New order")} className="fixed end-4 bottom-28 z-20 grid size-14 place-items-center rounded-2xl bg-yellow-500 text-ink shadow-lg shadow-ink/25 transition-colors hover:bg-yellow-600 active:bg-yellow-700">
        <Plus className="size-7" aria-hidden="true" />
      </Link>
    </>
  );
}
