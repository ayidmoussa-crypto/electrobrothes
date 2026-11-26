"use client";

import { Select } from "@/components/ui/Select";
import { LoaderCircle, Store, Truck, UserCheck } from "lucide-react";
import { searchCustomers } from "@/app/actions/admin-customers";
import { customerSearchTerms, type PastCustomer } from "@/lib/customer-search";
import { formatMoroccanPhone } from "@/lib/phone";
import { CustomerPicker } from "./CustomerPicker";
import { OrderLinesPicker, type OrderLine, type PickVariant } from "./OrderLinesPicker";
import { useActionState, useState } from "react";
import { createOrderByHand, type ActionState } from "@/app/actions/admin-orders";
import { buttonClass } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/forms";
import { MANUAL_SOURCES, MANUAL_SOURCES_EN, manualTotals, START_AS, START_AS_EN, suggestedShipping } from "@/lib/manual-order";
import { useAdminTr } from "./AdminLang";
import { formatMAD } from "@/lib/money";
import { FormMessage, inputClass, L, Panel } from "./ui";

type StartAs = keyof typeof START_AS;
const START_HINT: Record<StartAs, [ar: string, en: string]> = {
  NEW: ["كيبقى جديد حتى تأكدو مع الزبون. المخزون ما كيتقاسش.", "Stays new until you confirm it with the customer. Stock is not touched."],
  CONFIRMED: ["الزبون أكّد: كيدخل مؤكَّد ويُخصم من المخزون.", "The customer confirmed: it goes in confirmed and comes off the stock."],
  DELIVERED: ["الزبون خدا السلعة من المحل: كتتسجل مبيوعة، كتخرج من المخزون، بلا توصيل، والفلوس عندك.", "The customer took the goods at the shop: recorded as sold, off the stock, no delivery, and the money is yours."],
};

export type { PickVariant };
export type PickCity = { id: string; name: string; fee: number };

export function ManualOrderForm({
  variants,
  cities,
  freeThreshold,
  defaults,
  agent = false,
  shopSale = false,
}: {
  variants: PickVariant[];
  cities: PickCity[];
  freeThreshold: number;
  defaults: { name: string; phone: string };
  /** A confirmation agent: no "sold at the shop", which puts cash in the owner's hands. */
  agent?: boolean;
  /** Opens ready for a sale at the shop. */
  shopSale?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createOrderByHand, {});
  const { tr, lang } = useAdminTr();
  const mad = (v: number) => formatMAD(v, lang);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [cityId, setCityId] = useState("");
  const [discount, setDiscount] = useState(0);
  // Follows the city and the free-delivery rule until the owner types an agreed fee.
  const [shippingTyped, setShippingTyped] = useState<number | null>(null);
  const [startAs, setStartAs] = useState<StartAs>(shopSale ? "DELIVERED" : "CONFIRMED");
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

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const city = cities.find((c) => c.id === cityId);
  // Sold at the shop: nothing to deliver.
  const shipping = inShop ? 0 : (shippingTyped ?? (city && lines.length ? suggestedShipping(subtotal, discount, city.fee, freeThreshold) : 0));
  const totals = manualTotals(lines, shipping, discount);

  const num = (s: string) => Math.max(0, Math.floor(Number(s) || 0));

  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      <div className="flex flex-col gap-6">
        {agent ? null : (
          <fieldset>
            <legend className="sr-only">{tr("نوع الطلب", "Order type")}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-warm-100 p-1">
              {[
                { shop: false, label: tr("طلب للتوصيل", "Order to deliver"), icon: Truck },
                { shop: true, label: tr("بيع فالمحل", "Shop sale"), icon: Store },
              ].map(({ shop, label, icon: Icon }) => (
                <label
                  key={label}
                  className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-warm-600 transition-colors has-checked:bg-yellow-500 has-checked:text-ink has-focus-visible:ring-3 has-focus-visible:ring-yellow-300"
                >
                  <input type="radio" name="orderType" checked={inShop === shop} onChange={() => setStartAs(shop ? "DELIVERED" : "CONFIRMED")} className="sr-only" />
                  <Icon className="size-4.5" aria-hidden="true" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
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
              <Select name="cityId" required value={cityId} onChange={(e) => setCityId(e.target.value)} className={inputClass}>
                <option value="">{tr("اختر المدينة", "Pick the city")}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </L>
            {inShop ? (
              <input type="hidden" name="source" value="OTHER" />
            ) : (
              <>
                <L label={tr("مصدر الطلب", "Order source")}>
                  <Select name="source" defaultValue="WHATSAPP" className={inputClass}>
                    {Object.entries(lang === "en" ? MANUAL_SOURCES_EN : MANUAL_SOURCES).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </L>
                <L label={tr("العنوان", "Address")} className="sm:col-span-2">
                  <input name="address" required maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
                </L>
              </>
            )}
            <L label={tr("ملاحظات (اختياري)", "Notes (optional)")} className="sm:col-span-2">
              <textarea name="notes" rows={2} maxLength={500} className={`${inputClass} py-2`} />
            </L>
          </div>
        </Panel>

        {/* Above the next card: glass cards each make their own layer, which would cover the search results. */}
        <Panel title={tr("المنتجات", "Products")} className="relative z-10">
          <OrderLinesPicker variants={variants} lines={lines} onChange={setLines} />
        </Panel>
      </div>

      <Panel title={tr("الملخص", "Summary")} className="h-fit lg:sticky lg:top-40">
        <div className={`grid gap-3 ${inShop ? "" : "grid-cols-2"}`}>
          <L label={tr("الخصم (درهم)", "Discount (MAD)")}>
            <input name="discount" type="number" min={0} value={discount} onChange={(e) => setDiscount(num(e.target.value))} className={inputClass} />
          </L>
          {inShop ? (
            <input type="hidden" name="shippingFee" value={0} />
          ) : (
            <L label={tr("التوصيل (درهم)", "Delivery (MAD)")}>
              <input name="shippingFee" type="number" min={0} value={shipping} onChange={(e) => setShippingTyped(num(e.target.value))} className={inputClass} />
            </L>
          )}
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
        {inShop ? (
          <>
            <input type="hidden" name="startAs" value="DELIVERED" />
            <p className="mt-4 text-xs text-warm-600">{tr(...START_HINT.DELIVERED)}</p>
          </>
        ) : (
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold text-ink">{tr("حالة الطلب", "Order status")}</legend>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-warm-100 p-1">
              {(Object.entries(lang === "en" ? START_AS_EN : START_AS) as [StartAs, string][]).filter(([value]) => value !== "DELIVERED").map(([value, label]) => (
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
        )}
        <button type="submit" disabled={pending || !lines.length || totals.total === null} className={buttonClass({ className: "mt-4 w-full" })}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {inShop ? tr("سجّل البيع", "Save sale") : tr("سجّل الطلب", "Save order")}
        </button>
        <div className="mt-3">
          <FormMessage state={state} />
        </div>
      </Panel>
    </form>
  );
}

