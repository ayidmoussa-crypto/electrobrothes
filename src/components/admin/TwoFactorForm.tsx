"use client";

import { Copy, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import type { ConfirmState } from "@/app/actions/admin-2fa";
import { buttonClass } from "@/components/ui/button";
import { useAdminTr } from "./AdminLang";
import { FormMessage, inputClass, L } from "./ui";

/**
 * A 6-digit code form whose action may answer with new backup codes. The codes are shown here once,
 * and the page is refreshed only when the owner says they saved them.
 */
export function TwoFactorCodeForm({ action, submitLabel }: { action: (prev: ConfirmState, fd: FormData) => Promise<ConfirmState>; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const { tr } = useAdminTr();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  if (state.ok && state.backupCodes) {
    const text = state.backupCodes.join("\n");
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">
          {tr("هادو الرموز الاحتياطية. كل واحد كيخدم مرة وحدة، وكيبانو هنا غير هاد المرة:", "Your backup codes. Each works once, and they are shown only this time:")}
        </p>
        <ol className="grid grid-cols-2 gap-2 rounded-lg bg-warm-100 p-3 font-mono text-base text-warm-800" dir="ltr">
          {state.backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <p className="text-sm text-warm-600">
          {tr("كتبهم فورقة ولا خليهم فمدير كلمات السر، بعيد على الهاتف.", "Write them on paper or keep them in a password manager, away from the phone.")}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass({ variant: "outline" })}
            onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})}
          >
            <Copy className="size-4" aria-hidden="true" />
            {copied ? tr("تنسخو", "Copied") : tr("نسخ", "Copy")}
          </button>
          <button type="button" className={buttonClass()} onClick={() => router.refresh()}>
            {tr("حفظتهم", "I saved them")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <L label={tr("الرمز ديال 6 أرقام من التطبيق", "6-digit code from the app")}>
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={20} dir="ltr" className={`${inputClass} max-w-48 text-center tracking-widest`} />
      </L>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass()}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {submitLabel}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
