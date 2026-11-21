"use client";

import { CircleCheck, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { subscribe, type SubscribeState } from "@/app/actions/subscribe";
import { Link } from "@/i18n/navigation";
import { submitKeepingValues } from "@/lib/forms";

/**
 * One slim white card sitting on the line where the page meets the black footer:
 * text on one side, the email field with its button inside on the other. On phones the two stack.
 */
export function EmailBox() {
  const t = useTranslations("emailBox");
  const locale = useLocale();
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, {});
  const error = state.status === "invalid" ? t("invalid") : state.status === "busy" ? t("busy") : null;

  return (
    <section aria-labelledby="email-box-title" className="relative isolate px-4 pt-8">
      {/* The footer's black starts halfway down the card, so the card bridges page and footer. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-1/2 -bottom-px -z-10 bg-ink" />
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 overflow-hidden rounded-2xl border border-warm-200 bg-white p-5 shadow-2xl shadow-ink/20 sm:p-7 md:flex-row md:items-center md:gap-10">
        {/* A yellow edge on the start side: the brand's energy line. */}
        <div aria-hidden="true" className="absolute inset-y-0 start-0 w-1.5 bg-yellow-500" />
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-yellow-500 text-ink shadow-md shadow-yellow-500/40">
            <Mail className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 id="email-box-title" className="text-xl md:text-2xl">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-warm-600">{t("subtitle")}</p>
          </div>
        </div>

        <div className="md:w-[26rem] md:shrink-0">
          <div aria-live="polite">
            {state.status === "ok" ? (
              <p className="flex items-center gap-2 font-bold text-success">
                <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
                {t("done")}
              </p>
            ) : null}
          </div>
          {state.status === "ok" ? null : (
            <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} noValidate>
              <input type="hidden" name="locale" value={locale} />
              {/* Honeypot: out of sight and out of the tab order. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -start-[9999px] size-px opacity-0" />
              <div
                className={`flex items-center gap-2 ${error ? "[&_input]:border-danger" : ""}`}
              >
                <label htmlFor="email-box-input" className="sr-only">
                  {t("label")}
                </label>
                <input
                  id="email-box-input"
                  name="email"
                  type="email"
                  required
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  placeholder="name@example.com"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "email-box-error" : undefined}
                  className="min-h-12 min-w-0 flex-1 rounded-md border border-warm-200 bg-warm-100 px-4 text-base text-warm-800 outline-none transition-colors placeholder:text-sm placeholder:text-warm-400 hover:border-warm-400 focus:border-ink focus:bg-white rtl:text-right"
                />
                                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-md bg-yellow-500 px-5 font-extrabold shadow-sm shadow-yellow-500/40 text-ink transition-colors duration-150 hover:bg-yellow-600 active:bg-yellow-700 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400"
                >
                  {t("cta")}
                </button>
              </div>
              {error ? (
                <p id="email-box-error" role="alert" className="mt-2 text-sm font-semibold text-danger">
                  {error}
                </p>
              ) : null}
              <p className="mt-2.5 text-xs text-warm-600">
                {t("privacy")}{" "}
                <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">
                  {t("privacyLink")}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
