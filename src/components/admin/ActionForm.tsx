"use client";

import { LoaderCircle } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/forms";
import { useAdminTr } from "./AdminLang";
import { useConfirm } from "./ConfirmDialog";
import { FormMessage } from "./ui";

type State = { ok?: boolean; message?: string };

/** Admin form wired to a server action that returns { ok, message }; shows pending + result. */
export function ActionForm({
  action,
  children,
  submitLabel,
  variant = "primary",
  className = "flex flex-col gap-3",
  confirm,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  children?: ReactNode;
  submitLabel: string;
  variant?: ButtonVariant;
  className?: string;
  /** Ask before destructive actions. */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  const [ask, dialog] = useConfirm();
  const { tr } = useAdminTr();
  // A saved form shows the saved values and an "add" form empties; a failed one keeps what was typed.
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <>
      <form
        ref={form}
        action={formAction}
        onSubmit={(e) => {
          if (!confirm) return submitKeepingValues(e, formAction);
          // Asked in the page first; the form is sent once the owner says yes.
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          ask({ title: confirm, yes: tr("نعم", "Yes") }).then((ok) => {
            if (ok) startTransition(() => formAction(data));
          });
        }}
        className={className}
      >
        {children}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={buttonClass({ variant })}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {submitLabel}
          </button>
          <FormMessage state={state} />
        </div>
      </form>
      {/* Beside the form, not in it: the dialog carries its own little form. */}
      {dialog}
    </>
  );
}
