"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { useAdminTr } from "./AdminLang";

type Ask = { title: string; detail?: ReactNode; yes: string; resolve: (ok: boolean) => void };

/**
 * An in-page "are you sure?" in place of window.confirm, which some browsers (and the app's own preview)
 * dismiss without showing, so the action silently never happened.
 * `const [confirm, dialog] = useConfirm()`, render `dialog`, then `if (!(await confirm({...}))) return;`.
 */
export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const { tr } = useAdminTr();
  const confirm = (q: Omit<Ask, "resolve" | "yes"> & { yes?: string }) =>
    new Promise<boolean>((resolve) => setAsk({ yes: tr("نعم، بدّل", "Yes, change"), ...q, resolve }));
  const dialog = ask ? (
    <ConfirmDialog
      ask={ask}
      onDone={(ok) => {
        ask.resolve(ok);
        setAsk(null);
      }}
    />
  ) : null;
  return [confirm, dialog] as const;
}

function ConfirmDialog({ ask, onDone }: { ask: Ask; onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { tr } = useAdminTr();
  useEffect(() => {
    // Modal: drawn above everything (portals included), focus kept inside, Escape cancels.
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onClose={(e) => onDone(e.currentTarget.returnValue === "yes")}
      // A click on the dim backdrop (outside the box) cancels too.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/50"
    >
      <form method="dialog" className="p-6">
        <h2 id="confirm-title" className="text-lg font-extrabold">
          {ask.title}
        </h2>
        {ask.detail ? <div className="mt-2 text-sm leading-relaxed text-warm-600">{ask.detail}</div> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button value="" className={buttonClass({ variant: "outline" })}>
            {tr("لا، رجع", "No, go back")}
          </button>
          <button value="yes" autoFocus className={buttonClass()}>
            {ask.yes}
          </button>
        </div>
      </form>
    </dialog>
  );
}
