"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { VisitInput } from "@/lib/visitors";

type Event = VisitInput extends infer E ? (E extends { path: string } ? Omit<E, "path"> : never) : never;

/** One anonymous analytics event (app/api/visit). sendBeacon survives the page leaving and never slows it. Never throws. */
export function sendVisit(e: Event) {
  try {
    const body = new Blob([JSON.stringify({ ...e, path: location.pathname })], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/visit", body)) void fetch("/api/visit", { method: "POST", body, keepalive: true });
  } catch {}
}

/** A page view on every page the visitor opens, in-app navigation included. */
export function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    sendVisit({ type: "page_view" });
  }, [pathname]);
  return null;
}

/** One event when this element first shows (a product page, a search result, the checkout). */
export function VisitEvent({ event }: { event: Event }) {
  const key = JSON.stringify(event);
  useEffect(() => {
    sendVisit(JSON.parse(key) as Event);
  }, [key]);
  return null;
}
