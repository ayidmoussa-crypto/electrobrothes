"use client";

import { X } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

const HIDDEN = "eb_wa_tab_hidden";

/**
 * WhatsApp as a slim tab on the side edge, written top to bottom: always in reach, never over a product or a
 * button. The small ✕ tucks it away for this visit.
 */
export function WhatsAppTab({ href, label, text, closeLabel, glyph }: { href: string; label: string; text: string; closeLabel: string; glyph: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  // Tucked away earlier in this visit (read in the browser only; the server always shows it).
  const hiddenBefore = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem(HIDDEN) !== null;
      } catch {
        return false;
      }
    },
    () => false,
  );

  if (hidden || hiddenBefore) return null;

  return (
    <div className="fixed end-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(HIDDEN, "1");
          } catch {}
        }}
        aria-label={closeLabel}
        className="me-1 grid size-7 cursor-pointer place-items-center rounded-full bg-white/90 text-warm-700 shadow-md shadow-ink/15 transition-colors hover:bg-white hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="group flex w-10 flex-col items-center gap-2 rounded-s-2xl bg-whatsapp py-3.5 text-ink shadow-lg shadow-ink/20 transition-[width,padding] duration-200 hover:w-12 focus-visible:w-12 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
      >
        <span className="transition-transform duration-200 group-hover:scale-110">{glyph}</span>
        <span className="text-sm font-extrabold whitespace-nowrap [writing-mode:vertical-rl]">{text}</span>
      </a>
    </div>
  );
}
