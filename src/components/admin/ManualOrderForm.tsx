"use client";

import { LoaderCircle, Minus, Plus, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { createOrderByHand, type ActionState } from "@/app/actions/admin-orders";
import { buttonClass } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/forms";
import { MANUAL_SOURCES, manualTotals, suggestedShipping } from "@/lib/manual-order";
import { formatMAD } from "@/lib/money";
import { FormMessage, inputClass, L, Panel } from "./ui";

export type PickVariant = { id: string; name: string; label: string | null; sku: string; price: number; stock: number; image: string | null };
export type PickCity = { id: string; name: string; fee: number };
type Line = { variantId: string; qty: number; unitPrice: number };

export function ManualOrderForm({
  variants,
  cities,
  freeThreshold,
  defaults,
}: {
  variants: PickVariant[];
  cities: PickCity[];
  freeThreshold: number;
  defaults: { name: string; phone: string };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createOrderByHand, {});
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [cityId, setCityId] = useState("");
  const [discount, setDiscount] = useState(0);
  // Follows the city and the free-delivery rule until the owner types an agreed fee.
  const [shippingTyped, setShippingTyped] = useState<number | null>(null);

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return variants.filter((v) => `${v.name} ${v.label ?? ""} ${v.sku}`.toLowerCase().includes(q)).slice(0, 8);
  }, [query, variants]);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const city = cities.find((c) => c.id === cityId);
  const shipping = shippingTyped ?? (city && lines.length ? suggestedShipping(subtotal, discount, city.fee, freeThreshold) : 0);
  const totals = manualTotals(lines, shipping, discount);

  const add = (v: PickVariant) => {
    setLines((all) => (all.some((l) => l.variantId === v.id) ? all : [...all, { variantId: v.id, qty: 1, unitPrice: v.price }]));
    setQuery("");
  };
  const patch = (id: string, change: Partial<Line>) => setLines((all) => all.map((l) => (l.variantId === id ? { ...l, ...change } : l)));
  const num = (s: string) => Math.max(0, Math.floor(Number(s) || 0));

  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      <div className="flex flex-col gap-6">
        {/* Above the next card: glass cards each make their own layer, which would cover the search results. */}
        <Panel title="المنتجات" className="relative z-10">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-warm-500" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                // Enter adds the first match instead of sending a half-filled order.
                e.preventDefault();
                if (results[0] && results[0].stock > 0) add(results[0]);
              }}
              placeholder="ابحث باسم المنتج أو الـ SKU"
              aria-label="ابحث عن منتج"
              className={`${inputClass} ps-9`}
            />
            {results.length ? (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-warm-200 bg-white p-1 shadow-lg shadow-ink/10">
                {results.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      disabled={v.stock < 1}
                      onClick={() => add(v)}
                      className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-start text-sm hover:bg-warm-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Thumb src={v.image} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{v.name}</span>
                        <span className="block truncate text-xs text-warm-600">
                          {v.label ? `${v.label} · ` : ""}
                          {v.stock < 1 ? "نفد المخزون" : `بقي ${v.stock}`}
                        </span>
                      </span>
                      <span className="shrink-0 font-bold text-ink">{formatMAD(v.price, "ar")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim() ? (
              <p className="mt-2 text-sm text-warm-600">ما كاين حتى منتج بهاد الاسم.</p>
            ) : null}
          </div>

          {lines.length ? (
            <ul className="mt-4 flex flex-col gap-3">
              {lines.map((l) => {
                const v = byId.get(l.variantId)!;
                return (
                  <li key={l.variantId} className="flex flex-wrap items-center gap-3 border-b border-warm-200 pb-3 last:border-0 last:pb-0">
                    <Thumb src={v.image} />
                    <span className="min-w-40 flex-1 text-sm">
                      <span className="block font-semibold text-ink">{v.name}</span>
                      <span className="block text-xs text-warm-600">
                        {v.label ? `${v.label} · ` : ""}بقي {v.stock}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label="نقّص الكمية" disabled={l.qty <= 1} onClick={() => patch(l.variantId, { qty: l.qty - 1 })} className={buttonClass({ variant: "outline", size: "icon" })}>
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center font-bold text-ink" aria-live="polite">
                        {l.qty}
                      </span>
                      <button type="button" aria-label="زيد الكمية" disabled={l.qty >= v.stock} onClick={() => patch(l.variantId, { qty: l.qty + 1 })} className={buttonClass({ variant: "outline", size: "icon" })}>
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </span>
                    <L label="الثمن" className="w-24">
                      <input type="number" min={0} value={l.unitPrice} onChange={(e) => patch(l.variantId, { unitPrice: num(e.target.value) })} className={inputClass} />
                    </L>
                    <button type="button" aria-label={`حيد ${v.name}`} onClick={() => setLines((all) => all.filter((x) => x.variantId !== l.variantId))} className={buttonClass({ variant: "ghost", size: "icon" })}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-warm-600">ابحث عن منتج وزيدو للطلب.</p>
          )}
        </Panel>

        <Panel title="الزبون">
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="الاسم">
              <input name="name" required maxLength={80} defaultValue={defaults.name} className={inputClass} />
            </L>
            <L label="الهاتف">
              <input name="phone" type="tel" inputMode="tel" required dir="ltr" defaultValue={defaults.phone} className={`${inputClass} text-start`} />
            </L>
            <L label="المدينة">
              <select name="cityId" required value={cityId} onChange={(e) => setCityId(e.target.value)} className={inputClass}>
                <option value="">اختر المدينة</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </L>
            <L label="مصدر الطلب">
              <select name="source" defaultValue="WHATSAPP" className={inputClass}>
                {Object.entries(MANUAL_SOURCES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </L>
            <L label="العنوان" className="sm:col-span-2">
              <input name="address" required maxLength={300} className={inputClass} />
            </L>
            <L label="ملاحظات (اختياري)" className="sm:col-span-2">
              <textarea name="notes" rows={2} maxLength={500} className={`${inputClass} py-2`} />
            </L>
          </div>
        </Panel>
      </div>

      <Panel title="الملخص" className="h-fit lg:sticky lg:top-40">
        <div className="grid grid-cols-2 gap-3">
          <L label="الخصم (درهم)">
            <input name="discount" type="number" min={0} value={discount} onChange={(e) => setDiscount(num(e.target.value))} className={inputClass} />
          </L>
          <L label="التوصيل (درهم)">
            <input name="shippingFee" type="number" min={0} value={shipping} onChange={(e) => setShippingTyped(num(e.target.value))} className={inputClass} />
          </L>
        </div>
        <dl className="mt-4 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-warm-600">المجموع الفرعي</dt>
            <dd>{formatMAD(subtotal, "ar")}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-warm-200 pt-2 text-base">
            <dt className="font-bold text-ink">المبلغ عند الاستلام</dt>
            <dd className="font-extrabold text-ink">{totals.total === null ? "—" : formatMAD(totals.total, "ar")}</dd>
          </div>
        </dl>
        {totals.total === null ? <p className="mt-2 text-sm font-medium text-danger">الخصم أكبر من ثمن المنتجات.</p> : null}
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm font-semibold text-ink">
          <input name="confirmNow" type="checkbox" defaultChecked className="mt-1 size-4 accent-ink" />
          <span>
            الزبون أكّد الطلب
            <span className="block text-xs font-normal text-warm-600">يدخل مباشرة كطلب مؤكَّد ويُخصم من المخزون.</span>
          </span>
        </label>
        <button type="submit" disabled={pending || !lines.length || totals.total === null} className={buttonClass({ className: "mt-4 w-full" })}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          سجّل الطلب
        </button>
        <div className="mt-3">
          <FormMessage state={state} />
        </div>
      </Panel>
    </form>
  );
}

function Thumb({ src }: { src: string | null }) {
  return <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white">{src ? <Image src={src} alt="" fill sizes="44px" unoptimized className="object-contain p-0.5" /> : null}</span>;
}
