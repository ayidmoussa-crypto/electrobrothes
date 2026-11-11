"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import Script from "next/script";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { enterGiveaway, type EntryState } from "@/app/actions/giveaway";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/Field";
import { Link } from "@/i18n/navigation";
import { submitKeepingValues } from "@/lib/forms";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Name, surname and a Moroccan number: the whole entry. Free, no account. */
export function GiveawayForm({ giveawayId, slug, drawLabel }: { giveawayId: string; slug: string; drawLabel: string }) {
  const t = useTranslations("giveaway");
  const locale = useLocale();
  const [state, action, pending] = useActionState<EntryState, FormData>(enterGiveaway, {});
  const alertRef = useRef<HTMLParagraphElement>(null);
  const fe = state.fieldErrors ?? {};
  const err = (k: keyof typeof fe) => (fe[k] ? t(`errors.${fe[k]}` as "errors.short") : undefined);
  const formError = state.status === "closed" || state.status === "busy" || state.status === "captcha" ? t(`errors.${state.status}`) : null;

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [state, formError]);

  if (state.status === "ok") {
    return (
      <div aria-live="polite" className="flex flex-col items-start gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-7" aria-hidden="true" />
        </span>
        <p className="text-xl font-extrabold text-ink">{t("done", { date: drawLabel })}</p>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} noValidate className="flex flex-col gap-4">
      <div>
        <h3 className="text-xl md:text-2xl">{t("formTitle")}</h3>
        <p className="mt-1 text-sm text-warm-600">{t("formSubtitle")}</p>
      </div>
      {formError ? (
        <p ref={alertRef} tabIndex={-1} role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      ) : null}
      <input type="hidden" name="giveawayId" value={giveawayId} />
      {/* Honeypot: out of sight and out of the tab order. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -start-[9999px] size-px opacity-0" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ga-first" label={t("firstName")} error={err("firstName")} required>
          {(p) => <Input {...p} name="firstName" autoComplete="given-name" maxLength={40} defaultValue={state.values?.firstName} />}
        </Field>
        <Field id="ga-last" label={t("lastName")} error={err("lastName")} required>
          {(p) => <Input {...p} name="lastName" autoComplete="family-name" maxLength={40} defaultValue={state.values?.lastName} />}
        </Field>
      </div>
      <Field id="ga-phone" label={t("phone")} hint={t("phoneHint")} error={err("phone")} required>
        {(p) => <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="06 12 34 56 78" maxLength={20} defaultValue={state.values?.phone} className="rtl:text-right" />}
      </Field>

      <div className="flex flex-col gap-2">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-warm-800">
          <input type="checkbox" name="rules" required aria-invalid={fe.rules ? true : undefined} aria-describedby={fe.rules ? "ga-rules-error" : undefined} className="mt-0.5 size-5 shrink-0 accent-ink" />
          <span>
            {t.rich("rulesAccept", {
              link: (chunks) => (
                <Link href={`/giveaway/${slug}#rules`} className="font-semibold text-ink underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {fe.rules ? (
          <p id="ga-rules-error" className="flex items-center gap-1 text-sm font-medium text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t("errors.rules")}
          </p>
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-warm-600">
          <input type="checkbox" name="marketing" className="mt-0.5 size-5 shrink-0 accent-ink" />
          <span>{t("marketing")}</span>
        </label>
      </div>

      {TURNSTILE_SITE_KEY ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-language={locale} data-size="flexible" />
        </>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClass({ size: "lg", className: "w-full" })}>
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
        {t("cta")}
      </button>
    </form>
  );
}
