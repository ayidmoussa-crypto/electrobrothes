"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useAdminTr } from "./AdminLang";

/** A link shown in full with a button that copies it. */
export function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const { tr } = useAdminTr();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (plain http on a phone): the link stays selectable in the field.
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-warm-600">{label}</span>
      <div className="flex items-center gap-2">
        <input readOnly value={url} dir="ltr" aria-label={label} onFocus={(e) => e.currentTarget.select()} className="admin-field min-h-11 min-w-0 flex-1 rounded-lg px-3 text-sm text-warm-800" />
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-white transition-colors hover:bg-warm-800"
        >
          {copied ? <Check className="size-4 text-yellow-500" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? tr("تنسخ", "Copied") : tr("نسخ", "Copy")}</span>
        </button>
      </div>
    </div>
  );
}
