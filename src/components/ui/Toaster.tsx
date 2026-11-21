"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { dismissToast, getServerToasts, getToasts, subscribeToasts, toast, type ToastItem, type ToastKind } from "@/lib/toast";

const ICON = { success: CircleCheck, error: CircleAlert, info: Info } satisfies Record<ToastKind, unknown>;
const CHIP: Record<ToastKind, string> = { success: "bg-success", error: "bg-danger", info: "bg-yellow-500 text-ink" };
const LIFE: Record<ToastKind, number> = { success: 4000, info: 4000, error: 7000 };

function Item({ t, closeLabel }: { t: ToastItem; closeLabel: string }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(t.id), LIFE[t.kind]);
    return () => clearTimeout(timer);
  }, [t.id, t.kind]);
  const Icon = ICON[t.kind];
  return (
    <li
      role={t.kind === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl bg-deep p-3 pe-2 text-white shadow-xl shadow-deep/30 ring-1 ring-white/10 animate-[toast-in_300ms_cubic-bezier(0.22,1,0.36,1)]"
    >
      <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white ${CHIP[t.kind]}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 py-1 text-sm font-semibold break-words">{t.message}</p>
      <button type="button" onClick={() => dismissToast(t.id)} aria-label={closeLabel} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-warm-300 transition-colors hover:bg-white/10 hover:text-white">
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Mount once per layout. `failed` is the sentence shown when a request fails without anyone catching it
 * (a lost connection, a server action that threw): so no failure is ever silent.
 */
export function Toaster({ closeLabel, failed, className = "" }: { closeLabel: string; failed: string; className?: string }) {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);

  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { name?: string } | undefined;
      // A cancelled request (navigating away) is not an error.
      if (reason?.name === "AbortError") return;
      console.error(e.reason);
      toast.error(failed);
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, [failed]);

  return (
    <ol aria-label="Notifications" className={`pointer-events-none fixed inset-x-0 bottom-4 z-[80] mx-auto flex w-full max-w-md flex-col gap-2 px-4 ${className}`}>
      {items.map((t) => (
        <Item key={t.id} t={t} closeLabel={closeLabel} />
      ))}
    </ol>
  );
}
