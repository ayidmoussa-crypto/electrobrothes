"use client";

import { Banknote, CircleAlert, LoaderCircle, Lock } from "lucide-react";
import Image from "next/image";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import type { CartBundle } from "@/app/actions/cart";
import { previewCoupon, submitOrder, type OrderFormState } from "@/app/actions/order";
import { buttonClass } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { CityPicker } from "./CityPicker";
import { TotalsList } from "./TotalsList";
import type { Locale } from "@/i18n/routing";
import { submitKeepingValues } from "@/lib/forms";
import { FreeDeliveryRail } from "./FreeDeliveryRail";
import { formatMAD } from "@/lib/money";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { computeTotals } from "@/lib/pricing";
import type { CheckoutConfig } from "@/lib/store-config";
import { packSaving } from "./useCartLines";

export type OrderLine = { variantId: string; productId: string; name: string; label: string | null; price: number; qty: number; image?: string | null };

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const CLEAR_CART_FLAG = "eb_clear_cart";

const FIELD_ERROR_KEY = { name: "name", phone: "phone", cityId: "city", address: "address", notes: "notes", items: "cart" } as const;

/**
 * Cash-on-delivery order form: no account, 4 required fields. Used on the checkout page
 * (whole cart) and inline on the product page (one item). Server re-validates and re-prices.
 */
export function OrderForm({
  lines,
  config,
  locale,
  source,
  title,
  bundles = [],
}: {
  lines: OrderLine[];
  bundles?: CartBundle[];
  config: CheckoutConfig;
  locale: Locale;
  source: "cart" | "product";
  title: string;
}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const [state, action, pending] = useActionState<OrderFormState, FormData>(submitOrder, {});
  const [cityId, setCityId] = useState(state.values?.cityId ?? "");
  const [phoneError, setPhoneError] = useState(false);
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const couponRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Time-to-fill is a bot signal; set after mount so the static HTML stays cacheable.
  useEffect(() => {
    if (startedRef.current) startedRef.current.value = String(Date.now());
  }, []);

  // On the product page the checkout starts when the shopper first touches the form
  // (the checkout page sends InitiateCheckout itself when it opens).
  const checkoutTracked = useRef(source === "cart");
  const trackCheckoutStart = () => {
    if (checkoutTracked.current) return;
    checkoutTracked.current = true;
    track({ name: "InitiateCheckout", items: lines.map((l) => ({ id: l.variantId, name: l.name, price: l.price, quantity: l.qty })) });
  };

  // Bring the error summary into view after a failed submit.
  useEffect(() => {
    if (!state.error) return;
    summaryRef.current?.focus();
    // No order was placed: a later quick order from a product page must not empty this cart.
    try {
      sessionStorage.removeItem(CLEAR_CART_FLAG);
    } catch {}
  }, [state]);

  const city = config.cities.find((c) => c.id === cityId);
  const pack = packSaving(lines, bundles, locale === "ar");
  const totals = computeTotals({
    items: lines.map((l) => ({ unitPrice: l.price, quantity: l.qty })),
    shippingFee: city?.shippingFee ?? 0,
    freeShippingThreshold: config.freeShippingThreshold,
    bundleDiscount: pack.discount,
    coupon: coupon
      ? { type: "FIXED", value: coupon.discount, minSubtotal: null, maxUses: null, usedCount: 0, startsAt: null, expiresAt: null, isActive: true }
      : null,
  });

  const fieldError = (f: keyof typeof FIELD_ERROR_KEY) =>
    state.fieldErrors?.[f] ? t(`errors.${FIELD_ERROR_KEY[f]}`) : undefined;

  const outOfStockNames = lines.filter((l) => state.variantIds?.includes(l.variantId)).map((l) => l.name).join("، ");
  const topError =
    state.error === "coupon"
      ? t(`couponErrors.${state.couponError ?? "not_found"}` as "couponErrors.not_found")
      : state.error === "out_of_stock"
        ? t("errors.out_of_stock", { products: outOfStockNames })
        : state.error
          ? t(`errors.${state.error}`)
          : null;

  async function applyCoupon() {
    const code = couponRef.current?.value ?? "";
    if (!code.trim()) return;
    // The coupon applies to what is left after the packs, as in the order action.
    const res = await previewCoupon(code, totals.subtotal - totals.bundleDiscount);
    if (res.discount !== undefined) {
      setCoupon({ code: code.trim().toUpperCase(), discount: res.discount });
      setCouponMsg(t("couponApplied", { amount: formatMAD(res.discount, locale) }));
    } else {
      setCoupon(null);
      setCouponMsg(t(`couponErrors.${res.error ?? "not_found"}` as "couponErrors.not_found"));
    }
  }

  const v = state.values ?? {};

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (source === "cart") {
          try {
            sessionStorage.setItem(CLEAR_CART_FLAG, "1");
          } catch {}
        }
        submitKeepingValues(e, action);
      }}
      onFocus={trackCheckoutStart}
      // Wide screens: the details on one side, what is being bought on the other (sticky), the button under the
      // details. Phones: details, then the summary, then the button.
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:gap-x-10"
      noValidate
    >
      <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
        <h2 className="text-xl">{title}</h2>

      {topError ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="flex gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {topError}
        </div>
      ) : null}

      <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ variantId: l.variantId, qty: l.qty })))} />
      <input type="hidden" name="locale" value={locale} />
      {/* No value prop: React would write it back over the time set after mount on every render. */}
      <input type="hidden" name="startedAt" ref={startedRef} />
      <input type="hidden" name="coupon" value={coupon?.code ?? ""} />
      {/* Honeypot: invisible to people, irresistible to bots. */}
      <div aria-hidden="true" className="pointer-events-none absolute size-px overflow-hidden opacity-0 [clip-path:inset(50%)]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <Field id={`${source}-name`} label={t("name")} required error={fieldError("name")}>
        {(p) => <Input {...p} name="name" autoComplete="name" defaultValue={v.name} maxLength={80} />}
      </Field>

      <Field
        id={`${source}-phone`}
        label={t("phone")}
        hint={t("phoneHint")}
        required
        error={fieldError("phone") ?? (phoneError ? t("errors.phone") : undefined)}
      >
        {(p) => (
          <Input
            {...p}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="06 12 34 56 78"
            defaultValue={v.phone}
            onBlur={(e) => setPhoneError(e.target.value.trim() !== "" && !normalizeMoroccanPhone(e.target.value))}
            onChange={() => phoneError && setPhoneError(false)}
            className="text-start"
          />
        )}
      </Field>

      <Field id={`${source}-city`} label={t("city")} required error={fieldError("cityId")}>
        {(p) => (
          <CityPicker
            {...p}
            name="cityId"
            value={cityId}
            onChange={setCityId}
            cities={config.cities}
            locale={locale}
            placeholder={t("chooseCity")}
            searchLabel={t("searchCity")}
            emptyLabel={t("noCity")}
          />
        )}
      </Field>

      <Field id={`${source}-address`} label={t("address")} hint={t("addressHint")} required error={fieldError("address")}>
        {(p) => <Input {...p} name="address" autoComplete="street-address" defaultValue={v.address} maxLength={300} />}
      </Field>

      <Field id={`${source}-notes`} label={t("notes")} optionalLabel={t("optional")} error={fieldError("notes")}>
        {(p) => <Textarea {...p} name="notes" defaultValue={v.notes} maxLength={500} rows={2} />}
      </Field>
      </div>

      <aside aria-label={tc("summary")} className="flex flex-col gap-4 rounded-3xl bg-warm-100 p-4 sm:p-5 lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <h2 className="text-lg">{tc("summary")}</h2>
        <ul className="flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l.variantId} className="flex items-center gap-3">
              <span className="relative size-16 shrink-0">
                <span className="absolute inset-0 overflow-hidden rounded-2xl border border-warm-200 bg-white">
                  {l.image ? <Image src={l.image} alt="" fill sizes="64px" unoptimized={l.image.endsWith(".svg")} className="object-contain p-1.5" /> : null}
                </span>
                <span className="absolute -end-1.5 -top-1.5 grid min-w-6 place-items-center rounded-full bg-ink px-1.5 text-xs leading-6 font-bold text-white tabular-nums">{l.qty}</span>
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="line-clamp-2 font-semibold text-ink">{l.name}</span>
                {l.label ? <span className="block text-xs text-warm-600">{l.label}</span> : null}
              </span>
              <span className="shrink-0 text-sm font-bold text-ink tabular-nums">{formatMAD(l.price * l.qty, locale)}</span>
            </li>
          ))}
        </ul>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${source}-coupon`} className="text-sm font-semibold text-ink">
          {t("coupon")} <span className="font-normal text-warm-500">({t("optional")})</span>
        </label>
        <div className="flex gap-2">
          <Input id={`${source}-coupon`} ref={couponRef} dir="ltr" autoComplete="off" className="uppercase" aria-describedby={`${source}-coupon-msg`} />
          <button type="button" onClick={applyCoupon} className={buttonClass({ variant: "outline" })}>
            {t("applyCoupon")}
          </button>
        </div>
        <p id={`${source}-coupon-msg`} aria-live="polite" className={`text-sm ${coupon ? "text-success" : "text-danger"}`}>
          {couponMsg}
        </p>
      </div>

      <div className="border-t border-warm-200 pt-4 text-sm">
        <TotalsList
          locale={locale}
          subtotal={totals.subtotal}
          packDiscount={totals.bundleDiscount}
          packNames={pack.names}
          couponDiscount={totals.discount - totals.bundleDiscount}
          shipping={city ? totals.shipping : null}
          total={totals.total}
        />
        {city ? <p className="mt-1 text-xs text-warm-600">{t("deliveryIn", { days: city.deliveryDays })}</p> : null}
        <FreeDeliveryRail spent={totals.subtotal - totals.discount} threshold={config.freeShippingThreshold} locale={locale} />
      </div>
      </aside>

      <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-2">
      <div className="flex items-start gap-3 rounded-xl bg-ink p-4 text-white">
        <Banknote className="size-6 shrink-0 text-yellow-500" aria-hidden="true" />
        <div>
          <p className="font-bold">{t("codBanner")}</p>
          <p className="text-sm text-warm-300">{t("codText")}</p>
        </div>
      </div>

      {TURNSTILE_SITE_KEY ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-language={locale} data-size="flexible" />
        </>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClass({ size: "lg", className: "w-full" })}>
        {pending ? (
          <>
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            {t("submitting")}
          </>
        ) : (
          <>
            {t("submit")} — {formatMAD(totals.total, locale)}
          </>
        )}
      </button>
      <p className="flex items-center justify-center gap-1 text-xs text-warm-600">
        <Lock className="size-3.5" aria-hidden="true" />
        {t("trust")}
      </p>
      </div>
    </form>
  );
}
