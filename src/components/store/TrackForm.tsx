"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { trackOrder, type TrackState } from "@/app/actions/order";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/Field";
import type { Locale } from "@/i18n/routing";
import { CARRIER_LABEL, isCarrierStatus, type CarrierStatus } from "@/lib/carrier/status";
import { formatMAD } from "@/lib/money";

const tone: Record<string, BadgeTone> = {
  NEW: "accent",
  CONFIRMED: "success",
  SHIPPING: "ink",
  DELIVERED: "success",
  RETURNED: "warning",
  CANCELLED: "danger",
};

export function TrackForm() {
  const t = useTranslations("track");
  const to = useTranslations("order");
  const locale = useLocale() as Locale;
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, {});
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const o = state.order;

  return (
    <div className="flex flex-col gap-8">
      <form action={action} className="flex max-w-md flex-col gap-4">
        {state.error ? (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t(`errors.${state.error}`)}
          </p>
        ) : null}
        <Field id="track-number" label={t("number")} hint={t("numberHint")} required>
          {(p) => <Input {...p} name="number" dir="ltr" autoComplete="off" defaultValue={state.values?.number} className="text-start uppercase" />}
        </Field>
        <Field id="track-phone" label={t("phone")} required>
          {(p) => (
            <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" defaultValue={state.values?.phone} className="text-start" />
          )}
        </Field>
        <button type="submit" disabled={pending} className={buttonClass()}>
          {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
          {t("submit")}
        </button>
      </form>

      {o ? (
        <section aria-live="polite" className="max-w-2xl rounded-xl border border-warm-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xl font-extrabold text-ink" dir="ltr">
              {o.number}
            </p>
            <Badge tone={tone[o.status] ?? "neutral"} className="text-sm">
              {t("currentStatus")}: {to(`status.${o.status}` as "status.NEW")}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-warm-600">
            {t("placedOn")}: {date.format(new Date(o.createdAt))} · {o.cityName} · {formatMAD(o.total, locale)}
          </p>
          <ul className="mt-3 text-sm text-warm-800">
            {o.items.map((i, n) => (
              <li key={n}>
                {locale === "ar" ? i.nameAr : i.nameEn}
                {i.variantLabel ? ` · ${i.variantLabel}` : ""} × {i.quantity}
              </li>
            ))}
          </ul>
          <h2 className="mt-5 text-base">{t("history")}</h2>
          <ol className="mt-2 flex flex-col gap-3 border-s-2 border-warm-200 ps-4">
            {o.logs.map((l, n) => (
              <li key={n} className="relative">
                <CircleCheck className="absolute -start-[1.6rem] top-0.5 size-4 bg-white text-success" aria-hidden="true" />
                <p className="font-semibold text-ink">{to(`status.${l.toStatus}` as "status.NEW")}</p>
                <p className="text-xs text-warm-600">{date.format(new Date(l.createdAt))}</p>
              </li>
            ))}
          </ol>
          {o.trackingNumber || o.events.length ? (
            <>
              <h2 className="mt-5 text-base">{t("shipment")}</h2>
              {o.trackingNumber ? (
                <p className="mt-1 text-sm text-warm-600">
                  {t("trackingNumber")}: <span dir="ltr">{o.trackingNumber}</span>
                </p>
              ) : null}
              <ol className="mt-2 flex flex-col gap-3 border-s-2 border-warm-200 ps-4">
                {o.events.filter((e) => isCarrierStatus(e.status)).map((e, n) => (
                  <li key={n} className="relative">
                    <CircleCheck className="absolute -start-[1.6rem] top-0.5 size-4 bg-white text-success" aria-hidden="true" />
                    <p className="font-semibold text-ink">{CARRIER_LABEL[e.status as CarrierStatus][locale]}</p>
                    <p className="text-xs text-warm-600">{date.format(new Date(e.occurredAt))}</p>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
