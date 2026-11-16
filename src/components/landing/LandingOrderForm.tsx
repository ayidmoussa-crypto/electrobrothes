"use client";

import { CircleAlert, CircleCheck, LoaderCircle, Lock, Minus, Plus } from "lucide-react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitLandingOrder, type LandingOrderState } from "@/app/actions/order";
import { sendCampaignEvent } from "@/components/analytics/CampaignTracker";
import { CityPicker } from "@/components/store/CityPicker";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/Field";
import { track } from "@/lib/analytics";
import { submitKeepingValues } from "@/lib/forms";
import { formatMAD } from "@/lib/money";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { computeTotals } from "@/lib/pricing";
import type { CheckoutConfig } from "@/lib/store-config";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const FIELD_ERROR_KEY = { name: "name", phone: "phone", cityId: "city", address: "address", notes: "notes", items: "cart" } as const;

export type LandingVariant = { id: string; label: string; price: number; stock: number; colorHex: string | null };

/**
 * The cash-on-delivery form at the end of every landing page: name, phone, city, address, quantity and the option
 * when there is more than one. It goes through the shop's own order action (Turnstile, risk, same-basket dedupe);
 * the button is off while sending, and the thanks replace the form.
 */
export function LandingOrderForm({
  productId,
  productName,
  variants,
  defaultVariantId,
  config,
  template,
}: {
  productId: string;
  productName: string;
  variants: LandingVariant[];
  defaultVariantId: string;
  config: CheckoutConfig;
  template: string;
}) {
  const t = useTranslations("landing");
  const tc = useTranslations("checkout");
  const [state, action, pending] = useActionState<LandingOrderState, FormData>(submitLandingOrder, {});
  const [variantId, setVariantId] = useState(defaultVariantId);
  const [qty, setQty] = useState(1);
  const [cityId, setCityId] = useState(state.values?.cityId ?? "");
  const [phoneError, setPhoneError] = useState(false);
  const startedRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const maxQty = Math.max(1, Math.min(10, variant.stock));
  const city = config.cities.find((c) => c.id === cityId);
  const totals = computeTotals({ items: [{ unitPrice: variant.price, quantity: qty }], shippingFee: city?.shippingFee ?? 0, freeShippingThreshold: config.freeShippingThreshold, coupon: null });

  useEffect(() => {
    if (startedRef.current) startedRef.current.value = String(Date.now());
  }, []);

  useEffect(() => {
    if (state.done) {
      doneRef.current?.focus();
      track({ name: "Purchase", orderNumber: state.done.number, value: totals.total, items: [{ id: variant.id, name: productName, price: variant.price, quantity: qty }] });
      sendCampaignEvent({ type: "order_form_submit", source: "page", productId, template });
    } else if (state.error) summaryRef.current?.focus();
    // Only when a new answer comes back from the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state.done) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="flex flex-col items-center gap-3 rounded-3xl bg-success-soft p-6 text-center">
        <CircleCheck className="size-10 text-success" aria-hidden="true" />
        <p className="text-xl font-extrabold text-ink">{t("success")}</p>
        <p className="text-warm-700">{t("successNumber", { number: state.done.number })}</p>
      </div>
    );
  }

  const fieldError = (f: keyof typeof FIELD_ERROR_KEY) => (state.fieldErrors?.[f] ? tc(`errors.${FIELD_ERROR_KEY[f]}`) : undefined);
  const topError = state.error === "out_of_stock" ? tc("errors.out_of_stock", { products: productName }) : state.error ? tc(`errors.${state.error}`) : null;
  const v = state.values ?? {};

  return (
    <form
      action={action}
      onSubmit={(e) => submitKeepingValues(e, action)}
      onFocus={() => {
        if (tracked.current) return;
        tracked.current = true;
        track({ name: "InitiateCheckout", items: [{ id: variant.id, name: productName, price: variant.price, quantity: qty }] });
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {topError ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="flex gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {topError}
        </div>
      ) : null}

      <input type="hidden" name="items" value={JSON.stringify([{ variantId: variant.id, qty }])} />
      <input type="hidden" name="locale" value="ar" />
      <input type="hidden" name="landingTemplate" value={template} />
      <input type="hidden" name="startedAt" ref={startedRef} />
      <div aria-hidden="true" className="pointer-events-none absolute size-px overflow-hidden opacity-0 [clip-path:inset(50%)]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {variants.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">{t("variant")}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((o) => {
              const out = o.stock <= 0;
              return (
                <label
                  key={o.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold has-checked:border-ink has-checked:bg-ink has-checked:text-white has-disabled:cursor-not-allowed has-disabled:text-warm-400 has-disabled:line-through ${out ? "border-warm-200" : "border-warm-300 text-ink"}`}
                >
                  <input
                    type="radio"
                    name="variantChoice"
                    value={o.id}
                    checked={o.id === variant.id}
                    disabled={out}
                    onChange={() => {
                      setVariantId(o.id);
                      setQty((n) => Math.min(n, Math.max(1, Math.min(10, o.stock))));
                    }}
                    className="sr-only"
                  />
                  {/* Product swatch colour: catalog data, not a UI colour. */}
                  {o.colorHex ? <span aria-hidden="true" className="size-4 rounded-full border border-warm-300" style={{ backgroundColor: o.colorHex }} /> : null}
                  {o.label}
                  <span className="font-normal">· {formatMAD(o.price, "ar")}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <Field id="lp-name" label={tc("name")} required error={fieldError("name")}>
        {(p) => <Input {...p} name="name" autoComplete="name" defaultValue={v.name} maxLength={80} />}
      </Field>

      <Field id="lp-phone" label={tc("phone")} hint={tc("phoneHint")} required error={fieldError("phone") ?? (phoneError ? tc("errors.phone") : undefined)}>
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

      <Field id="lp-city" label={tc("city")} required error={fieldError("cityId")}>
        {(p) => (
          <CityPicker
            {...p}
            name="cityId"
            value={cityId}
            onChange={setCityId}
            cities={config.cities}
            locale="ar"
            placeholder={tc("chooseCity")}
            searchLabel={tc("searchCity")}
            emptyLabel={tc("noCity")}
          />
        )}
      </Field>

      <Field id="lp-address" label={tc("address")} hint={tc("addressHint")} required error={fieldError("address")}>
        {(p) => <Input {...p} name="address" autoComplete="street-address" defaultValue={v.address} maxLength={300} />}
      </Field>

      <div className="flex items-center justify-between gap-3">
        <span id="lp-qty-label" className="text-sm font-semibold text-ink">
          {t("quantity")}
        </span>
        <div role="group" aria-labelledby="lp-qty-label" className="flex items-center gap-1 rounded-full border border-warm-200 bg-warm-100 p-1">
          <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={qty <= 1} aria-label={t("decrease")} className={buttonClass({ variant: "ghost", size: "icon", className: "rounded-full" })}>
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <output aria-live="polite" className="min-w-8 text-center text-lg font-bold tabular-nums">
            {qty}
          </output>
          <button type="button" onClick={() => setQty((n) => Math.min(maxQty, n + 1))} disabled={qty >= maxQty} aria-label={t("increase")} className={buttonClass({ variant: "ghost", size: "icon", className: "rounded-full" })}>
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <dl className="flex flex-col gap-1 rounded-2xl bg-warm-100 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-warm-600">{t("subtotal")}</dt>
          <dd className="font-semibold tabular-nums">{formatMAD(totals.subtotal, "ar")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-warm-600">{t("shipping")}</dt>
          <dd className="font-semibold">{city ? (totals.shipping ? formatMAD(totals.shipping, "ar") : t("free")) : t("shippingByCity")}</dd>
        </div>
        <div className="mt-1 flex justify-between border-t border-warm-200 pt-2 text-base">
          <dt className="font-bold text-ink">{t("total")}</dt>
          <dd className="font-extrabold text-ink tabular-nums">{formatMAD(totals.total, "ar")}</dd>
        </div>
      </dl>

      {TURNSTILE_SITE_KEY ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-language="ar" data-size="flexible" />
        </>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClass({ size: "lg", className: "w-full rounded-full font-extrabold" })}>
        {pending ? (
          <>
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            {tc("submitting")}
          </>
        ) : (
          t("submit")
        )}
      </button>
      <p className="flex items-center justify-center gap-1 text-xs text-warm-600">
        <Lock className="size-3.5" aria-hidden="true" />
        {tc("trust")}
      </p>
    </form>
  );
}
