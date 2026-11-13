"use client";

import { CircleCheck, CircleMinus, Download, LoaderCircle, Send, Truck, X } from "lucide-react";
import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { assignCarrier, type CarrierAssignResult } from "@/app/actions/admin-orders";
import { buttonClass } from "@/components/ui/button";
import { shipBlock, type OrderStatus } from "@/lib/order-rules";
import { useAdminTr } from "./AdminLang";
import { CarrierLogo } from "./CarrierLogo";
import { DeleteOrders } from "./DeleteOrders";

export type SelectableOrder = { id: string; number: string; customerName: string; cityName: string; status: OrderStatus; trackingNumber: string | null };
export type CarrierChoice = { id: string; name: string; logoUrl: string | null; isDefault: boolean };

type Selection = { ids: string[]; picked: Set<string>; toggle: (id: string) => void; setAll: (on: boolean) => void; clear: () => void };
const SelectionContext = createContext<Selection | null>(null);
const useSelection = () => use(SelectionContext)!;

/** Holds which orders of this page are ticked; the table rows and the bar below read it. */
export function OrderSelectionProvider({ ids, children }: { ids: string[]; children: ReactNode }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setAll = (on: boolean) => setPicked(on ? new Set(ids) : new Set());
  return <SelectionContext value={{ ids, picked, toggle, setAll, clear: () => setPicked(new Set()) }}>{children}</SelectionContext>;
}

const box = "size-5 cursor-pointer accent-ink";

export function RowCheck({ id, number }: { id: string; number: string }) {
  const { picked, toggle } = useSelection();
  const { tr } = useAdminTr();
  return <input type="checkbox" checked={picked.has(id)} onChange={() => toggle(id)} aria-label={tr(`اختيار الطلب ${number}`, `Select order ${number}`)} className={box} />;
}

export function AllCheck() {
  const { ids, picked, setAll } = useSelection();
  const { tr } = useAdminTr();
  const ref = useRef<HTMLInputElement>(null);
  const all = ids.length > 0 && picked.size === ids.length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = picked.size > 0 && !all;
  }, [picked.size, all]);
  return <input ref={ref} type="checkbox" checked={all} onChange={() => setAll(!all)} aria-label={tr("اختيار كل الطلبات فهاد الصفحة", "Select every order on this page")} className={box} disabled={!ids.length} />;
}

/** Appears once an order is ticked: hand them to a delivery company, download their CSV, or delete them. */
export function SelectionBar({ orders, carriers }: { orders: SelectableOrder[]; carriers: CarrierChoice[] }) {
  const { picked, clear } = useSelection();
  const { tr } = useAdminTr();
  const [open, setOpen] = useState(false);
  if (!picked.size) return null;
  const chosen = orders.filter((o) => picked.has(o.id));

  return (
    <>
      <div role="region" aria-label={tr("الطلبات المختارة", "Selected orders")} className="sticky bottom-4 z-20 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl bg-ink p-2 ps-4 text-white shadow-2xl">
        <span className="text-sm font-bold" aria-live="polite">
          {tr(`${picked.size} طلب مختار`, `${picked.size} selected`)}
        </span>
        <button type="button" onClick={() => setOpen(true)} className={buttonClass()}>
          <Truck className="size-4" aria-hidden="true" />
          {tr("لشركة التوصيل", "To the carrier")}
        </button>
        <a
          href={`/admin/orders/export?ids=${[...picked].join(",")}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-warm-700 px-4 text-sm font-bold text-white transition-colors hover:bg-warm-900 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
        >
          <Download className="size-4" aria-hidden="true" />
          CSV
        </a>
        <DeleteOrders ids={[...picked]} label={chosen.map((o) => o.number).join(", ")} variant="bar" onDone={clear} />
        <button type="button" onClick={clear} aria-label={tr("إلغاء الاختيار", "Clear selection")} className="grid size-11 place-items-center rounded-xl text-warm-300 hover:bg-warm-900 hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {open ? <CarrierDialog orders={chosen} carriers={carriers} onClose={() => setOpen(false)} onDone={clear} /> : null}
    </>
  );
}

function CarrierDialog({ orders, carriers, onClose, onDone }: { orders: SelectableOrder[]; carriers: CarrierChoice[]; onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { tr } = useAdminTr();
  const [carrierId, setCarrierId] = useState(carriers.find((c) => c.isDefault)?.id ?? carriers[0]?.id ?? "");
  const [result, setResult] = useState<CarrierAssignResult | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const why = { not_confirmed: tr("ماشي مؤكَّد", "Not confirmed"), has_tracking: tr("خرج من قبل", "Already sent") };
  const ready = orders.filter((o) => !shipBlock(o.status, o.trackingNumber));
  const carrier = carriers.find((c) => c.id === carrierId);
  const outcome = (id: string) => result?.results.find((r) => r.id === id);

  return (
    <dialog
      ref={ref}
      aria-labelledby="carrier-title"
      onClose={() => {
        if (result?.ok) onDone();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/50"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center gap-3 border-b border-warm-200 p-5">
          {carrier ? <CarrierLogo name={carrier.name} logoUrl={carrier.logoUrl} className="size-10" /> : <Truck className="size-6" aria-hidden="true" />}
          <h2 id="carrier-title" className="text-lg font-extrabold">
            {tr(`${orders.length} طلب لشركة التوصيل`, `${orders.length} orders to the carrier`)}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!carriers.length ? (
            <p className="rounded-xl bg-warm-100 p-3 text-sm text-warm-700">
              {tr("ما كاينة حتى شركة توصيل خدامة. زيدها من الإعدادات ← شركات التوصيل.", "No active delivery company. Add one in Settings → Delivery companies.")}
            </p>
          ) : (
            <fieldset disabled={pending || !!result}>
              <legend className="mb-2 text-sm font-bold">{tr("الشركة", "Company")}</legend>
              <div className="flex flex-wrap gap-2">
                {carriers.map((c) => (
                  <label key={c.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold ${c.id === carrierId ? "border-ink bg-yellow-50" : "border-warm-200"}`}>
                    <input type="radio" name="carrier" value={c.id} checked={c.id === carrierId} onChange={() => setCarrierId(c.id)} className="sr-only" />
                    <CarrierLogo name={c.name} logoUrl={c.logoUrl} className="size-7" />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <ol className="mt-4 flex flex-col gap-2">
            {orders.map((o, i) => {
              const block = shipBlock(o.status, o.trackingNumber);
              const done = outcome(o.id);
              const ok = done ? done.ok : !block;
              return (
                <li key={o.id} className="flex items-center gap-3 rounded-xl border border-warm-200 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-warm-100 text-xs font-bold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-bold" dir="ltr">
                      {o.number}
                    </span>
                    <span className="block truncate text-xs text-warm-600">
                      {o.customerName} · {o.cityName}
                    </span>
                  </span>
                  {done?.ok ? (
                    <CircleCheck className="size-6 shrink-0 text-success" aria-label={tr("تربط", "Assigned")} />
                  ) : ok ? (
                    <span className="text-xs font-semibold text-success">{tr("جاهز", "Ready")}</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-warm-600">
                      <CircleMinus className="size-4" aria-hidden="true" />
                      {done?.reason ?? (block ? why[block] : "")}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <p className="mt-4 rounded-xl bg-warm-100 p-3 text-xs leading-relaxed text-warm-700">
            {tr(
              "الإرسال المباشر للشركة (رقم التتبع كيرجع بوحدو) كيتفعّل ملي توصلنا وثائق الـ API والدخول ديال الشركة. دابا: «ربط» كيحط الشركة على الطلبات المؤكَّدة باش يبان اللوغو ديالها، و CSV كتصيفطو ليهم.",
              "Direct sending (the tracking number comes back on its own) switches on once we have the company's API documents and login. For now, “Assign” puts the company on the confirmed orders so its logo shows, and the CSV is what you send them.",
            )}
          </p>
          {result?.message ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              {result.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-warm-200 p-4">
          <form method="dialog">
            <button className={buttonClass({ variant: "outline" })}>{result?.ok ? tr("سد", "Close") : tr("رجع", "Back")}</button>
          </form>
          {ready.length ? (
            <a href={`/admin/orders/export?ids=${ready.map((o) => o.id).join(",")}`} className={buttonClass({ variant: "outline" })}>
              <Download className="size-4" aria-hidden="true" />
              {tr(`CSV ديال ${ready.length}`, `CSV of ${ready.length}`)}
            </a>
          ) : null}
          <button type="button" disabled title={tr("كيتفعّل ملي يتربط الـ API ديال الشركة", "Switches on once the company's API is connected")} className={buttonClass({ variant: "dark" })}>
            <Send className="size-4" aria-hidden="true" />
            {tr("إرسال مباشر", "Send directly")}
          </button>
          {!result?.ok && carrier ? (
            <button
              type="button"
              disabled={pending || !ready.length || !carrierId}
              onClick={() => start(async () => setResult(await assignCarrier({ orderIds: orders.map((o) => o.id), carrierId })))}
              className={buttonClass()}
            >
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Truck className="size-4" aria-hidden="true" />}
              {tr(`ربط ${ready.length} بـ ${carrier?.name ?? ""}`, `Assign ${ready.length} to ${carrier?.name ?? ""}`)}
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
