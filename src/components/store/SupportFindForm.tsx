"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { findSupport, type FindSupportState } from "@/app/actions/support";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/Field";

/** Order number + phone: opens the private support chat of a delivered order. */
export function SupportFindForm({ initial }: { initial?: { number: string; phone: string } }) {
  const t = useTranslations("support");
  const tt = useTranslations("track");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FindSupportState, FormData>(findSupport.bind(null, locale), {});

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {state.error ? (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <Field id="support-number" label={tt("number")} hint={tt("numberHint")} required>
        {(p) => <Input {...p} name="number" dir="ltr" autoComplete="off" defaultValue={state.values?.number ?? initial?.number} className="text-start uppercase" />}
      </Field>
      <Field id="support-phone" label={tt("phone")} required>
        {(p) => <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" defaultValue={state.values?.phone ?? initial?.phone} className="text-start" />}
      </Field>
      <button type="submit" disabled={pending} className={buttonClass()}>
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
        {t("submit")}
      </button>
    </form>
  );
}
