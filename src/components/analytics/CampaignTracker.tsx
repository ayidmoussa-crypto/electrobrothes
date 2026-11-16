"use client";

import { useEffect } from "react";
import { OFFER_COOKIE, OFFER_COOKIE_DAYS, type CampaignEventInput } from "@/lib/offers";

/** Sends one event without slowing the click: sendBeacon survives the page leaving. Never throws. */
export function sendCampaignEvent(e: CampaignEventInput) {
  try {
    const body = new Blob([JSON.stringify(e)], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/track", body)) void fetch("/api/track", { method: "POST", body, keepalive: true });
  } catch {}
}

/**
 * One listener for the whole page: any link or button with data-track="<event>" reports its click, with its
 * data-offer, data-product and data-template. A home offer's "shop now" also remembers the offer for 7 days, so the
 * order placed later can be counted for it.
 */
export function CampaignTracker({ source }: { source: "home" | "page" }) {
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as Element | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      const d = el.dataset;
      const type = d.track as CampaignEventInput["type"];
      sendCampaignEvent({ type, source, offerId: d.offer ?? null, productId: d.product ?? null, template: d.template ?? null });
      if (source === "home" && type === "hero_cta_click" && d.offer) {
        document.cookie = `${OFFER_COOKIE}=${encodeURIComponent(d.offer)}; max-age=${OFFER_COOKIE_DAYS * 86400}; path=/; samesite=lax`;
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [source]);
  return null;
}
