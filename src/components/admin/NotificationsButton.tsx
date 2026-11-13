"use client";

import type { LucideIcon } from "lucide-react";
import { Bell, ChevronLeft, ChevronRight, CircleCheck, Landmark, MessagesSquare, PackageX, Settings, ShoppingCart, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AlertGroup, AlertGroupId, AlertTone } from "@/lib/admin-alerts";
import { useAdminTr } from "./AdminLang";

const ICON: Record<AlertGroupId, LucideIcon> = { orders: ShoppingCart, messages: MessagesSquare, stock: PackageX, reviews: Star, finance: Landmark, system: Settings };
const TONE: Record<AlertTone, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning-text",
  info: "bg-warm-100 text-warm-700",
};

/** The side rail's panels close each other: only one floats at a time. */
export const PANEL_EVENT = "admin-panel-open";
export function announcePanel(id: string) {
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: id }));
}

/** Where the button lives: the desktop side rail, or the phone's top bar. The panel opens beside it. */
export type Placement = "rail" | "bar";
export const PANEL_PLACE: Record<Placement, string> = {
  rail: "fixed inset-y-6 end-24 z-50 my-auto w-[26rem]",
  bar: "fixed inset-x-3 top-[5.5rem] bottom-28 z-50",
};

/**
 * The bell: everything that needs the team, grouped (orders, messages, stock, reviews, finance, setup), with a
 * chip per group to narrow the list. Each line opens the page where it gets done.
 */
export function NotificationsButton({ groups, placement }: { groups: AlertGroup[]; placement: Placement }) {
  const { tr, ar } = useAdminTr();
  const [open, setOpen] = useState(false);
  const [only, setOnly] = useState<AlertGroupId | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const id = `alerts-${placement}`;
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const urgent = groups.some((g) => g.items.some((i) => i.tone === "danger"));
  const shown = only ? groups.filter((g) => g.id === only) : groups;
  const Arrow = ar ? ChevronLeft : ChevronRight;

  useEffect(() => {
    const other = (e: Event) => (e as CustomEvent<string>).detail !== id && setOpen(false);
    window.addEventListener(PANEL_EVENT, other);
    return () => window.removeEventListener(PANEL_EVENT, other);
  }, [id]);

  // A tap outside or Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const toggle = () => {
    if (!open) announcePanel(id);
    setOpen(!open);
  };
  const size = placement === "rail" ? "size-12" : "size-10";
  const chip = (on: boolean) =>
    `inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-bold whitespace-nowrap transition-colors ${on ? "bg-ink text-white" : "bg-white/70 text-warm-800 hover:bg-white"}`;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={total ? tr(`الإشعارات: ${total}`, `Notifications: ${total}`) : tr("الإشعارات", "Notifications")}
        title={tr("الإشعارات", "Notifications")}
        className={`relative grid ${size} cursor-pointer place-items-center rounded-full text-ink transition-colors ${open ? "bg-ink text-white" : "bg-white/70 hover:bg-white"}`}
      >
        <Bell className="size-5" aria-hidden="true" />
        {total ? (
          <span className={`absolute -top-1 -end-1 grid min-w-5 place-items-center rounded-full px-1 text-[11px] leading-5 font-extrabold tabular-nums ring-2 ring-white ${urgent ? "bg-danger text-white" : "bg-yellow-500 text-ink"}`}>
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <section role="dialog" aria-label={tr("الإشعارات", "Notifications")} className={`${PANEL_PLACE[placement]} ${placement === "rail" ? "h-fit" : ""} glass-frost flex max-h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-3xl border shadow-2xl shadow-ink/20`}>
          <header className="flex items-center justify-between gap-2 px-4 pt-4">
            <h2 className="flex items-center gap-2 text-base">
              <Bell className="size-5" aria-hidden="true" />
              {tr("الإشعارات", "Notifications")}
              {total ? <span className="rounded-full bg-ink px-2 text-xs leading-5 text-white tabular-nums">{total}</span> : null}
            </h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={tr("سد", "Close")} className="grid size-9 cursor-pointer place-items-center rounded-full text-warm-800 hover:bg-white/70">
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          {groups.length > 1 ? (
            <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-1 [scrollbar-width:none]">
              <button type="button" aria-pressed={only === null} onClick={() => setOnly(null)} className={chip(only === null)}>
                {tr("الكل", "All")} <span className="tabular-nums opacity-70">{total}</span>
              </button>
              {groups.map((g) => {
                const Icon = ICON[g.id];
                return (
                  <button key={g.id} type="button" aria-pressed={only === g.id} onClick={() => setOnly(only === g.id ? null : g.id)} className={chip(only === g.id)}>
                    <Icon className="size-3.5" aria-hidden="true" />
                    {g.title} <span className="tabular-nums opacity-70">{g.items.length}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-3">
            {shown.length ? (
              shown.map((g) => {
                const Icon = ICON[g.id];
                return (
                  <section key={g.id} aria-label={g.title} className="mt-2 first:mt-0">
                    <h3 className="flex items-center gap-1.5 px-1 py-1.5 text-xs font-bold text-warm-600">
                      <Icon className="size-3.5" aria-hidden="true" />
                      {g.title}
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {g.items.map((item) => (
                        <li key={item.id}>
                          <Link href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-2xl bg-white/75 p-3 transition-colors hover:bg-white">
                            <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${TONE[item.tone]}`}>
                              <Icon className="size-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold text-ink">{item.title}</span>
                              {item.detail ? <span className="mt-0.5 block text-xs break-words text-warm-600">{item.detail}</span> : null}
                              {item.code ? (
                                <span dir="ltr" className="mt-1.5 block rounded-lg bg-warm-100 px-2 py-1 text-start text-[11px] leading-relaxed break-all text-warm-800">
                                  {item.code}
                                </span>
                              ) : null}
                            </span>
                            <Arrow className="mt-1.5 size-4 shrink-0 text-warm-500" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            ) : (
              <p className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-warm-600">
                <CircleCheck className="size-8 text-success" aria-hidden="true" />
                {tr("ما كاين والو كيتسناك. كلشي مزيان.", "Nothing waiting for you. All good.")}
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
