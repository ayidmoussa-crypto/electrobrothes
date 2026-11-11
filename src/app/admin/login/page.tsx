"use client";

import { motion } from "framer-motion";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, useSyncExternalStore } from "react";
import { login, type LoginState } from "@/app/actions/admin-auth";
import { AdminBackdrop } from "@/components/admin/AdminBackdrop";
import { Logo } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/Field";
import { tr as pick } from "@/lib/admin-tr";

const errors = {
  invalid: ["البريد الإلكتروني أو كلمة المرور غير صحيحة.", "Wrong email or password."],
  rate_limited: ["محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجدداً.", "Too many attempts. Wait 15 minutes, then try again."],
} as const;

// Before login there is no panel cookie to read here: the page follows the browser's language.
const browserLang = () => (navigator.language.startsWith("ar") ? "ar" : "en");

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  // The server renders Arabic; the browser then switches to its own language, without a hydration mismatch.
  const lang = useSyncExternalStore(
    () => () => {},
    browserLang,
    () => "ar" as const,
  );
  const tr = pick(lang);

  return (
    <main className="grid min-h-dvh place-items-center px-4" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <AdminBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="admin-card w-full max-w-sm p-6 sm:p-8"
      >
        <div className="mb-6 flex items-center gap-2">
          <Logo className="h-9 w-auto text-logo-dark" />
          <span className="text-lg font-extrabold text-ink" dir="ltr">
            ElectroBrothers
          </span>
        </div>
        <h1 className="text-2xl">{tr("تسجيل الدخول", "Log in")}</h1>
        <p className="mt-1 text-sm text-warm-600">{tr("لوحة تحكم المتجر", "Shop dashboard")}</p>

        <form action={action} className="mt-6 flex flex-col gap-4">
          {state.error ? (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              {tr(errors[state.error][0], errors[state.error][1])}
            </p>
          ) : null}
          <Field id="email" label={tr("البريد الإلكتروني", "Email")} required>
            {(p) => <Input {...p} name="email" type="email" autoComplete="username" dir="ltr" defaultValue={state.email} className="text-start" />}
          </Field>
          <Field id="password" label={tr("كلمة المرور", "Password")} required>
            {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" dir="ltr" className="text-start" />}
          </Field>
          <button type="submit" disabled={pending} className={buttonClass({ size: "lg" })}>
            {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
            {tr("دخول", "Log in")}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
