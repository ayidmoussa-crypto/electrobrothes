"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The phone's fixed order bar shows only while the page's own "order now" button is off screen, so the shopper never
 * sees two order buttons at once. Put `buttonRef` on the main button; `enabled` is false when nothing can be bought. While the bar shows, `<html data-order-bar>` lifts the floating WhatsApp button above it. An effect,
 * not a CSS :has() on the bar: Next keeps a left page in the DOM, hidden, and an effect is the part that stops.
 */
export function useOrderBar<T extends HTMLElement>(enabled: boolean) {
  const buttonRef = useRef<T>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = buttonRef.current;
    if (!enabled || !el) return;
    const seen = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting));
    seen.observe(el);
    return () => seen.disconnect();
  }, [enabled]);

  const visible = enabled && show;
  useEffect(() => {
    if (!visible) return;
    document.documentElement.dataset.orderBar = "";
    return () => {
      delete document.documentElement.dataset.orderBar;
    };
  }, [visible]);

  return { buttonRef, visible };
}
