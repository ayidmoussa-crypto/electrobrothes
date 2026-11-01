"use client";

import { Banknote, CircleAlert, LoaderCircle, Lock } from "lucide-react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { previewCoupon, submitOrder, type OrderFormState } from "@/app/actions/order";
import { buttonClass } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { Locale } from "@/i18n/routing";
import { formatMAD } from "@/lib/money";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { computeTotals } from "@/lib/pricing";
import type { CheckoutConfig } from "@/lib/store-config";

export type OrderLine = { variantId: string; name: string; label: string | null; price: number; qty: number };

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
}: {
  lines: OrderLine[];
  config: CheckoutConfig;
  locale: Locale;
  source: "cart" | "product";
  title: string;
}) {
  const t = useTranslations("checkout");
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
    if (state.error) summaryRef.current?.focus();
  }, [state]);

  const city = config.cities.find((c) => c.id === cityId);
  const totals = computeTotals({
    items: lines.map((l) => ({ unitPrice: l.price, quantity: l.qty })),
    shippingFee: city?.shippingFee ?? 0,
    freeShippingThreshold: config.freeShippingThreshold,
    coupon: coupon
      ? { type: "FIXED", value: coupon.discount, minSubtotal: null, maxUses: null, usedCount: 0, startsAt: null, expiresAt: null, isActive: true }
      : null,
  });
  const missingForFree = config.freeShippingThreshold - (totals.subtotal - totals.discount);

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
    const res = await previewCoupon(code, totals.subtotal);
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
      onSubmit={() => {
        if (source === "cart") {
          try {
            sessionStorage.setItem(CLEAR_CART_FLAG, "1");
          } catch {}
        }
      }}
      onFocus={trackCheckoutStart}
      className="flex flex-col gap-5"
      noValidate
    >
      <h2 className="text-xl">{title}</h2>

      {topError ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="flex gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {topError}
        </div>
      ) : null}

      <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ variantId: l.variantId, qty: l.qty })))} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startedAt" ref={startedRef} defaultValue="" />
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
          <Select {...p} name="cityId" value={cityId} onChange={(e) => setCityId(e.target.value)} autoComplete="address-level2">
            {/* Not disabled: React's post-submit form reset would otherwise jump to the first city. */}
            <option value="">{t("chooseCity")}</option>
            {config.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "ar" ? c.nameAr : c.nameEn} — {formatMAD(c.shippingFee, locale)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field id={`${source}-address`} label={t("address")} hint={t("addressHint")} required error={fieldError("address")}>
        {(p) => <Input {...p} name="address" autoComplete="street-address" defaultValue={v.address} maxLength={300} />}
      </Field>

      <Field id={`${source}-notes`} label={t("notes")} optionalLabel={t("optional")} error={fieldError("notes")}>
        {(p) => <Textarea {...p} name="notes" defaultValue={v.notes} maxLength={500} rows={2} />}
      </Field>

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

      {/* Summary */}
      <div className="rounded-xl border border-warm-200 bg-warm-50 p-4 text-sm">
        <ul className="mb-3 flex flex-col gap-1 border-b border-warm-200 pb-3">
          {lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-3">
              <span className="text-warm-800">
                {l.name}
                {l.label ? <span className="text-warm-600"> · {l.label}</span> : null}
                <span className="text-warm-600"> × {l.qty}</span>
              </span>
              <span className="shrink-0 font-semibold text-ink">{formatMAD(l.price * l.qty, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1">
          <div className="flex justify-between">
            <dt className="text-warm-600">{t("subtotal")}</dt>
            <dd className="font-semibold text-ink">{formatMAD(totals.subtotal, locale)}</dd>
          </div>
          {totals.discount ? (
            <div className="flex justify-between">
              <dt className="text-warm-600">{t("discount")}</dt>
              <dd className="font-semibold text-success">−{formatMAD(totals.discount, locale)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-warm-600">{t("shipping")}</dt>
            <dd className="font-semibold text-ink">
              {!city ? t("chooseCityForShipping") : totals.shipping === 0 ? t("free") : formatMAD(totals.shipping, locale)}
            </dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-warm-200 pt-2 text-base">
            <dt className="font-bold text-ink">{t("total")}</dt>
            <dd className="text-xl font-extrabold text-ink">{formatMAD(totals.total, locale)}</dd>
          </div>
        </dl>
        {missingForFree > 0 ? (
          <p className="mt-2 text-xs text-warm-600">{t("freeShippingHint", { amount: formatMAD(missingForFree, locale) })}</p>
        ) : null}
        {city ? <p className="mt-1 text-xs text-warm-600">{t("deliveryIn", { days: city.deliveryDays })}</p> : null}
      </div>

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
    </form>
  );
}
