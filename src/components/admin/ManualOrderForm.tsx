"use client";

import { LoaderCircle, Minus, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { searchCustomers } from "@/app/actions/admin-customers";
import { customerSearchTerms, type PastCustomer } from "@/lib/customer-search";
import { formatMoroccanPhone } from "@/lib/phone";
import { CustomerPicker } from "./CustomerPicker";
import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { createOrderByHand, type ActionState } from "@/app/actions/admin-orders";
import { buttonClass } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/forms";
import { IN_SHOP_ADDRESS, MANUAL_SOURCES, MANUAL_SOURCES_EN, manualTotals, START_AS, START_AS_EN, suggestedShipping } from "@/lib/manual-order";
import { useAdminTr } from "./AdminLang";
import { formatMAD } from "@/lib/money";
import { FormMessage, inputClass, L, Panel } from "./ui";

type StartAs = keyof typeof START_AS;
const START_HINT: Record<StartAs, [ar: string, en: string]> = {
  NEW: ["كيبقى جديد حتى تأكدو مع الزبون. المخزون ما كيتقاسش.", "Stays new until you confirm it with the customer. Stock is not touched."],
  CONFIRMED: ["الزبون أكّد: كيدخل مؤكَّد ويُخصم من المخزون.", "The customer confirmed: it goes in confirmed and comes off the stock."],
  DELIVERED: ["الزبون جا للمحل وخدا السلعة: كيتسجل مسلَّم، بلا توصيل، والفلوس عندك.", "The customer came to the shop and took the goods: recorded as delivered, no delivery, and the money is yours."],
};

export type PickVariant = { id: string; productId: string; name: string; label: string | null; colorHex: string | null; sku: string; price: number; stock: number; image: string | null };
export type PickCity = { id: string; name: string; fee: number };
type Line = { variantId: string; qty: number; unitPrice: number };

export function ManualOrderForm({
  variants,
  cities,
  freeThreshold,
  defaults,
  agent = false,
}: {
  variants: PickVariant[];
  cities: PickCity[];
  freeThreshold: number;
  defaults: { name: string; phone: string };
  /** A confirmation agent: no "sold at the shop", which puts cash in the owner's hands. */
  agent?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createOrderByHand, {});
  const { tr, lang } = useAdminTr();
  const mad = (v: number) => formatMAD(v, lang);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [cityId, setCityId] = useState("");
  const [discount, setDiscount] = useState(0);
  // Follows the city and the free-delivery rule until the owner types an agreed fee.
  const [shippingTyped, setShippingTyped] = useState<number | null>(null);
  const [startAs, setStartAs] = useState<StartAs>("CONFIRMED");
  const inShop = startAs === "DELIVERED";
  // The customer fields, filled by hand or from a past buyer picked above them.
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [address, setAddress] = useState("");
  const [picked, setPicked] = useState<PastCustomer | null>(null);
  // A phone typed by hand that belongs to a past buyer: offered once, never filled in behind the admin's back.
  const [known, setKnown] = useState<PastCustomer | null>(null);

  const fillFrom = (c: PastCustomer) => {
    setPicked(c);
    setKnown(null);
    setName(c.name);
    setPhone(c.phone.startsWith("+212") ? formatMoroccanPhone(c.phone) : c.phone);
    setAddress(c.address);
    // Only a city the shop still delivers to; otherwise the admin picks one.
    if (cities.some((x) => x.id === c.cityId)) setCityId(c.cityId);
  };
  const checkPhone = async () => {
    const { digits } = customerSearchTerms(phone);
    if (picked || digits.length < 9) return;
    const found = (await searchCustomers(phone).catch(() => [])).find((c) => customerSearchTerms(c.phone).digits === digits);
    setKnown(found ?? null);
  };

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  // One result per product, whatever its colours: the colour is chosen afterwards, on the order line.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const products = new Map<string, PickVariant[]>();
    for (const v of variants) {
      if (!`${v.name} ${v.label ?? ""} ${v.sku}`.toLowerCase().includes(q)) continue;
      products.set(v.productId, variants.filter((x) => x.productId === v.productId));
    }
    return [...products.values()].slice(0, 8);
  }, [query, variants]);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const city = cities.find((c) => c.id === cityId);
  // Sold at the shop: nothing to deliver.
  const shipping = shippingTyped ?? (!inShop && city && lines.length ? suggestedShipping(subtotal, discount, city.fee, freeThreshold) : 0);
  const totals = manualTotals(lines, shipping, discount);

  // A product goes in with its first colour in stock that is not already in the order (a second tap adds a second colour).
  const nextOf = (group: PickVariant[]) => group.find((v) => v.stock > 0 && !lines.some((l) => l.variantId === v.id));
  const add = (group: PickVariant[]) => {
    const v = nextOf(group);
    if (v) setLines((all) => [...all, { variantId: v.id, qty: 1, unitPrice: v.price }]);
    setQuery("");
  };
  const patch = (id: string, change: Partial<Line>) => setLines((all) => all.map((l) => (l.variantId === id ? { ...l, ...change } : l)));
  const num = (s: string) => Math.max(0, Math.floor(Number(s) || 0));

  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      <div className="flex flex-col gap-6">
        {/* Who first, like a phone call: then what they want. Above the next card so its list of customers shows over it. */}
        <Panel title={tr("الزبون", "Customer")} className="relative z-20">
          <CustomerPicker picked={picked} onPick={fillFrom} onClear={() => setPicked(null)} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <L label={tr("الاسم", "Name")}>
              <input name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </L>
            <L label={tr("الهاتف", "Phone")}>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setKnown(null);
                }}
                onBlur={checkPhone}
                className={`${inputClass} text-start`}
              />
            </L>
            {known ? (
              <button
                type="button"
                onClick={() => fillFrom(known)}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-yellow-100 px-3 py-2.5 text-start text-sm text-yellow-900 transition-colors hover:bg-yellow-200 sm:col-span-2"
              >
                <UserCheck className="size-4.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  {tr(`هاد الرقم ديال ${known.name} (${known.orders} طلب).`, `This number belongs to ${known.name} (${known.orders} orders).`)}{" "}
                  <b className="underline underline-offset-2">{tr("عمّر المعلومات ديالو", "Use their details")}</b>
                </span>
              </button>
            ) : null}
            <L label={tr("المدينة", "City")}>
              <select name="cityId" required value={cityId} onChange={(e) => setCityId(e.target.value)} className={inputClass}>
                <option value="">{tr("اختر المدينة", "Pick the city")}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </L>
            <L label={tr("مصدر الطلب", "Order source")}>
              <select name="source" defaultValue="WHATSAPP" className={inputClass}>
                {Object.entries(lang === "en" ? MANUAL_SOURCES_EN : MANUAL_SOURCES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </L>
            <L label={inShop ? tr("العنوان (اختياري)", "Address (optional)") : tr("العنوان", "Address")} className="sm:col-span-2">
              <input name="address" required={!inShop} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={inShop ? IN_SHOP_ADDRESS : undefined} className={inputClass} />
            </L>
            <L label={tr("ملاحظات (اختياري)", "Notes (optional)")} className="sm:col-span-2">
              <textarea name="notes" rows={2} maxLength={500} className={`${inputClass} py-2`} />
            </L>
          </div>
        </Panel>

        {/* Above the next card: glass cards each make their own layer, which would cover the search results. */}
        <Panel title={tr("المنتجات", "Products")} className="relative z-10">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-warm-500" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                // Enter adds the first match instead of sending a half-filled order.
                e.preventDefault();
                if (results[0] && nextOf(results[0])) add(results[0]);
              }}
              placeholder={tr("ابحث باسم المنتج أو الـ SKU", "Search by product name or SKU")}
              aria-label={tr("ابحث عن منتج", "Search for a product")}
              className={`${inputClass} ps-9`}
            />
            {results.length ? (
              <ul className="animate-pop absolute inset-x-0 top-full z-20 mt-1 max-h-80 origin-top overflow-y-auto rounded-xl border border-warm-200 bg-white p-1 shadow-lg shadow-ink/10">
                {results.map((group) => {
                  const v = group[0];
                  const stock = group.reduce((s, x) => s + x.stock, 0);
                  const prices = group.map((x) => x.price);
                  const low = Math.min(...prices);
                  const colours = group.filter((x) => x.colorHex);
                  return (
                    <li key={v.productId}>
                      <button
                        type="button"
                        disabled={!nextOf(group)}
                        onClick={() => add(group)}
                        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-start text-sm hover:bg-warm-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Thumb src={v.image} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink">{v.name}</span>
                          <span className="flex items-center gap-1.5 text-xs text-warm-600">
                            {colours.length ? (
                              <span className="flex -space-x-1 rtl:space-x-reverse" aria-hidden="true">
                                {colours.map((x) => (
                                  <Swatch key={x.id} hex={x.colorHex} />
                                ))}
                              </span>
                            ) : null}
                            {colours.length > 1 ? tr(`${colours.length} ألوان · `, `${colours.length} colours · `) : ""}
                            {stock < 1 ? tr("نفد المخزون", "Out of stock") : tr(`بقي ${stock}`, `${stock} left`)}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold text-ink">
                          {Math.max(...prices) > low ? tr("من ", "From ") : ""}
                          {mad(low)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : query.trim() ? (
              <p className="mt-2 text-sm text-warm-600">{tr("ما كاين حتى منتج بهاد الاسم.", "No product with this name.")}</p>
            ) : null}
          </div>

          {lines.length ? (
            <ul className="mt-4 flex flex-col gap-3">
              {lines.map((l) => {
                const v = byId.get(l.variantId)!;
                // The other colours of the same product: one tap switches the line to that colour.
                const siblings = variants.filter((s) => s.productId === v.productId && s.colorHex);
                return (
                  <li key={l.variantId} className="flex flex-wrap items-center gap-3 border-b border-warm-200 pb-3 last:border-0 last:pb-0">
                    <Thumb src={v.image} />
                    <span className="min-w-40 flex-1 text-sm">
                      <span className="block font-semibold text-ink">{v.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-warm-600">
                        <Swatch hex={v.colorHex} />
                        {v.label ? `${v.label} · ` : ""}
                        {tr(`بقي ${v.stock}`, `${v.stock} left`)}
                      </span>
                      {siblings.length > 1 ? (
                        <span role="radiogroup" aria-label={tr(`لون ${v.name}`, `Colour of ${v.name}`)} className="mt-1.5 flex flex-wrap gap-1.5">
                          {siblings.map((s) => {
                            const taken = s.id !== v.id && lines.some((x) => x.variantId === s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                role="radio"
                                aria-checked={s.id === v.id}
                                aria-label={`${s.label ?? ""}${s.stock < 1 ? tr(" (نفد)", " (sold out)") : ""}`}
                                title={`${s.label ?? ""} · ${tr(`بقي ${s.stock}`, `${s.stock} left`)}`}
                                disabled={s.stock < 1 || taken}
                                onClick={() =>
                                  setLines((all) =>
                                    all.map((x) =>
                                      x.variantId === v.id
                                        ? // A price agreed by hand is kept; the shop price follows the colour.
                                          { variantId: s.id, qty: Math.min(x.qty, s.stock), unitPrice: x.unitPrice === v.price ? s.price : x.unitPrice }
                                        : x,
                                    ),
                                  )
                                }
                                className={`grid size-8 cursor-pointer place-items-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                                  s.id === v.id ? "border-ink" : "border-transparent hover:border-warm-300"
                                }`}
                              >
                                <Swatch hex={s.colorHex} size="size-6" />
                              </button>
                            );
                          })}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label={tr("نقّص الكمية", "Decrease quantity")} disabled={l.qty <= 1} onClick={() => patch(l.variantId, { qty: l.qty - 1 })} className={buttonClass({ variant: "outline", size: "icon" })}>
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center font-bold text-ink" aria-live="polite">
                        {l.qty}
                      </span>
                      <button type="button" aria-label={tr("زيد الكمية", "Increase quantity")} disabled={l.qty >= v.stock} onClick={() => patch(l.variantId, { qty: l.qty + 1 })} className={buttonClass({ variant: "outline", size: "icon" })}>
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </span>
                    <L label={tr("الثمن", "Price")} className="w-24">
                      <input type="number" min={0} value={l.unitPrice} onChange={(e) => patch(l.variantId, { unitPrice: num(e.target.value) })} className={inputClass} />
                    </L>
                    <button type="button" aria-label={tr(`حيد ${v.name}`, `Remove ${v.name}`)} onClick={() => setLines((all) => all.filter((x) => x.variantId !== l.variantId))} className={buttonClass({ variant: "ghost", size: "icon" })}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-warm-600">{tr("ابحث عن منتج وزيدو للطلب.", "Search for a product and add it to the order.")}</p>
          )}
        </Panel>
      </div>

      <Panel title={tr("الملخص", "Summary")} className="h-fit lg:sticky lg:top-40">
        <div className="grid grid-cols-2 gap-3">
          <L label={tr("الخصم (درهم)", "Discount (MAD)")}>
            <input name="discount" type="number" min={0} value={discount} onChange={(e) => setDiscount(num(e.target.value))} className={inputClass} />
          </L>
          <L label={tr("التوصيل (درهم)", "Delivery (MAD)")}>
            <input name="shippingFee" type="number" min={0} value={shipping} onChange={(e) => setShippingTyped(num(e.target.value))} className={inputClass} />
          </L>
        </div>
        <dl className="mt-4 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-warm-600">{tr("المجموع الفرعي", "Subtotal")}</dt>
            <dd>{mad(subtotal)}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-warm-200 pt-2 text-base">
            <dt className="font-bold text-ink">{inShop ? tr("المبلغ اللي خلّص", "Amount paid") : tr("المبلغ عند الاستلام", "Cash on delivery")}</dt>
            <dd className="font-extrabold text-ink">{totals.total === null ? "—" : mad(totals.total)}</dd>
          </div>
        </dl>
        {totals.total === null ? <p className="mt-2 text-sm font-medium text-danger">{tr("الخصم أكبر من ثمن المنتجات.", "The discount is larger than the products' price.")}</p> : null}
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-ink">{tr("حالة الطلب", "Order status")}</legend>
          <div className={`mt-2 grid gap-1 rounded-xl bg-warm-100 p-1 ${agent ? "grid-cols-2" : "grid-cols-3"}`}>
            {(Object.entries(lang === "en" ? START_AS_EN : START_AS) as [StartAs, string][]).filter(([value]) => !agent || value !== "DELIVERED").map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-sm font-semibold text-warm-600 transition-colors has-checked:bg-white has-checked:text-ink has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-yellow-300"
              >
                <input type="radio" name="startAs" value={value} checked={startAs === value} onChange={() => setStartAs(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-warm-600">{tr(...START_HINT[startAs])}</p>
        </fieldset>
        <button type="submit" disabled={pending || !lines.length || totals.total === null} className={buttonClass({ className: "mt-4 w-full" })}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {tr("سجّل الطلب", "Save order")}
        </button>
        <div className="mt-3">
          <FormMessage state={state} />
        </div>
      </Panel>
    </form>
  );
}

/** The colour's circle (product swatch data); nothing for a product without colours. */
function Swatch({ hex, size = "size-3.5" }: { hex: string | null; size?: string }) {
  return hex ? <span className={`${size} shrink-0 rounded-full border border-warm-300`} style={{ backgroundColor: hex }} aria-hidden="true" /> : null;
}

function Thumb({ src }: { src: string | null }) {
  return <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white">{src ? <Image src={src} alt="" fill sizes="44px" unoptimized className="object-contain p-0.5" /> : null}</span>;
}
