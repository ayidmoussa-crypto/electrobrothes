"use client";

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type Place = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

/** plain: the white list under a Select or a date field. glass: the frosted panel of the dashboard's bars. */
const SURFACE = {
  plain: "rounded-2xl bg-white shadow-xl shadow-deep/25 ring-1 ring-warm-200",
  glass: "glass-frost rounded-3xl border shadow-xl shadow-ink/15",
} as const;

/**
 * Where a panel opens: inside the admin's themed root when there is one (so night mode reaches it), else the page root.
 * Called from the click that opens the panel.
 */
export const panelHost = (from: Element | null) => from?.closest(".admin-theme") ?? document.body;

/**
 * The floating panel under Select and DateField. It sits at the page root (fixed position) so a scrolling table or a
 * card with a blur cannot cut it off. It opens under its anchor, or above when there is no room, follows the anchor
 * while the page scrolls, and closes on a tap outside or when the anchor leaves the screen.
 */
export function Popover({
  anchor,
  open,
  onClose,
  host,
  minWidth = 0,
  estimate = 280,
  surface = "plain",
  children,
  className = "",
  ...rest
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** The element the panel is drawn in: see panelHost. */
  host?: Element | null;
  /** The panel is as wide as its anchor, or this wide when the anchor is narrower. */
  minWidth?: number;
  /** About how tall the panel wants to be: decides between opening below or above. */
  estimate?: number;
  surface?: keyof typeof SURFACE;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- reads the anchor element's box on purpose; the ref object itself is stable
  const measure = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect();
    if (!a || a.bottom < 0 || a.top > window.innerHeight) return false;
    const width = Math.min(Math.max(a.width, minWidth), window.innerWidth - 16);
    const rtl = getComputedStyle(anchor.current!).direction === "rtl";
    const left = Math.min(Math.max(rtl ? a.right - width : a.left, 8), window.innerWidth - width - 8);
    const below = window.innerHeight - a.bottom - 14;
    const above = a.top - 14;
    const up = below < estimate && above > below;
    setPlace(up ? { bottom: window.innerHeight - a.top + 6, left, width, maxHeight: above } : { top: a.bottom + 6, left, width, maxHeight: below });
    return true;
  }, [anchor, minWidth, estimate]);

  // Stable, so React does not call it again on every render: it places the panel once, when it mounts.
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      panel.current = el;
      if (el) measure();
    },
    [measure],
  );

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      // A list opened from inside this panel (a Select in it) is drawn after it at the page root: not "outside".
      const other = t instanceof Element ? t.closest("[data-popover]") : null;
      if (other && panel.current && panel.current.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) return;
      onClose();
    };
    const follow = () => {
      if (!measure()) onClose();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open, anchor, measure, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      data-popover=""
      {...rest}
      // Placed the moment it mounts, before the browser paints; hidden until then.
      ref={attach}
      style={place ? { top: place.top, bottom: place.bottom, left: place.left, width: place.width, maxHeight: place.maxHeight } : { visibility: "hidden" }}
      className={`fixed z-[70] overflow-auto overscroll-contain ${SURFACE[surface]} ${className}`}
    >
      {children}
    </div>,
    host ?? document.body,
  );
}
