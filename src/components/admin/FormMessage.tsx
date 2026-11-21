"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/lib/toast";

type State = { ok?: boolean; message?: string };

/** The result of an admin form action, shown as a toast (green when it worked, red when it did not). */
export function FormMessage({ state }: { state: State }) {
  const shown = useRef<State | null>(null);
  useEffect(() => {
    if (!state.message || shown.current === state) return;
    shown.current = state;
    (state.ok ? toast.success : toast.error)(state.message);
  }, [state]);
  return null;
}
