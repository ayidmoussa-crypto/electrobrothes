"use client";

import { LoaderCircle, Brain } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** The one look for every "ask Claude" button in the admin. */
export function AiButton({ onClick, pending, children, className = "" }: { onClick: () => void; pending: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={pending} className={buttonClass({ variant: "dark", className })}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Brain className="size-4 text-yellow-500" aria-hidden="true" />}
      {children}
    </button>
  );
}
