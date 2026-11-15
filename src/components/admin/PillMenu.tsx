"use client";

import { ArrowLeftRight, Check, ChevronDown, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

const LIST_WIDTH = 192; // w-48

export type PillOption = { value: string; label: string; dot: string; danger?: boolean; disabled?: boolean };

/**
 * A small coloured pill that opens a list of choices. The list floats over the page (fixed position)
 * so a scrolling table cannot cut it off. Keyboard: arrows move, Enter picks, Escape closes.
 * `options` may hold the current value and choices that cannot be picked now: these show greyed out,
 * so the whole path stays readable.
 */
export function PillMenu({
  label,
  current,
  tone,
  options,
  pending,
  onPick,
  className = "",
  compact = false,
}: {
  /** A small round button (an icon, no text) where the label is already shown nearby, e.g. a board column. */
  compact?: boolean;
  /** Extra classes for the pill, e.g. a fixed width so pills in a column line up. */
  className?: string;
  /** Read by screen readers, e.g. "حالة الطلب EB-…". */
  label: string;
  current: PillOption;
  tone: string;
  options: PillOption[];
  pending: boolean;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const all = options.some((o) => o.value === current.value) ? options : [current, ...options];
  const pickable = (o: PillOption) => !o.disabled && o.value !== current.value;
  const choices = all.filter(pickable).length;
  /** The next index from `from` in direction `step` that can take the highlight (the current value can). */
  const move = (from: number, step: number) => {
    for (let k = 1; k <= all.length; k++) {
      const i = (from + step * k + all.length * k) % all.length;
      if (!all[i].disabled) return i;
    }
    return from;
  };

  /** Puts the list under the pill (above it when there is no room); false when the pill left the screen. */
  const place = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r || r.bottom < 0 || r.top > window.innerHeight) return false;
    const up = window.innerHeight - r.bottom < all.length * 40 + 24;
    // Aligned to the pill's start edge (right in Arabic), but never past the screen's left edge
    // (the list is LIST_WIDTH wide and hangs to the left of `left`).
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.min(Math.max(r.right, LIST_WIDTH + 8), window.innerWidth - 8), up });
    return true;
  };

  const show = () => {
    place();
    setActive(Math.max(0, all.findIndex((o) => o.value === current.value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const outside = (e: Event) => {
      if (list.current?.contains(e.target as Node) || button.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    // Scrolling the page or the table moves the list with its pill instead of closing it.
    const follow = () => {
      if (!place()) setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- place() only reads refs and the option count

  const pick = (o: PillOption) => {
    if (o.disabled) return;
    setOpen(false);
    button.current?.focus({ preventScroll: true });
    if (o.value !== current.value) onPick(o.value);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") button.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => move(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => move(a, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(all[active]);
    }
  };

  const disabled = pending || !choices;
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`${label}: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            show();
          }
        }}
        title={compact ? label : undefined}
        className={`${compact ? "grid size-7 shrink-0 place-items-center" : "inline-flex min-h-8 items-center gap-1 px-2.5"} rounded-full text-xs font-bold whitespace-nowrap transition-shadow ${tone} ${className} ${
          disabled ? "cursor-default" : "cursor-pointer hover:shadow-md hover:shadow-ink/10"
        } focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300`}
      >
        {compact ? null : current.label}
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        ) : compact ? (
          <ArrowLeftRight className="size-3.5" aria-hidden="true" />
        ) : choices ? (
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        ) : null}
      </button>

      {/* At the page root: a blurred card around the table would otherwise trap a fixed list and clip it. */}
      {open ? createPortal(
        <ul
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onKey}
          style={{ top: pos.top, left: pos.left, transform: `translate(-100%, ${pos.up ? "-100%" : "0"})` }}
          className="fixed z-50 w-48 rounded-2xl bg-white p-1.5 shadow-xl shadow-ink/15 ring-1 ring-warm-200 outline-none"
        >
          {all.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === current.value}
              aria-disabled={o.disabled || undefined}
              onPointerEnter={() => !o.disabled && setActive(i)}
              onClick={() => pick(o)}
              className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold ${
                o.disabled ? "cursor-not-allowed text-warm-400" : `cursor-pointer ${o.danger ? "text-danger" : "text-ink"}`
              } ${i === active && !o.disabled ? "bg-warm-100" : ""}`}
            >
              <span className={`size-2.5 shrink-0 rounded-full ${o.disabled ? "bg-warm-200" : o.dot}`} aria-hidden="true" />
              <span className="flex-1">{o.label}</span>
              {o.value === current.value ? <Check className="size-4 shrink-0 text-warm-600" aria-hidden="true" /> : null}
            </li>
          ))}
        </ul>,
        document.body,
      ) : null}
    </>
  );
}
