"use client";

import { motion } from "framer-motion";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/admin-auth";
import { AdminBackdrop } from "@/components/admin/AdminBackdrop";
import { Logo } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/Field";

const errors = {
  invalid: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  rate_limited: "محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجدداً.",
};

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <main className="grid min-h-dvh place-items-center px-4">
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
        <h1 className="text-2xl">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-warm-600">لوحة تحكم المتجر</p>

        <form action={action} className="mt-6 flex flex-col gap-4">
          {state.error ? (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              {errors[state.error]}
            </p>
          ) : null}
          <Field id="email" label="البريد الإلكتروني" required>
            {(p) => <Input {...p} name="email" type="email" autoComplete="username" dir="ltr" defaultValue={state.email} className="text-start" />}
          </Field>
          <Field id="password" label="كلمة المرور" required>
            {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" dir="ltr" className="text-start" />}
          </Field>
          <button type="submit" disabled={pending} className={buttonClass({ size: "lg" })}>
            {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
            دخول
          </button>
        </form>
      </motion.div>
    </main>
  );
}
