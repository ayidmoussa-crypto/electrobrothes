"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isVisitId, SESSION_MINUTES, VISIT_SESSION_COOKIE, VISITOR_COOKIE } from "@/lib/visit-ids";
import type { VisitInput } from "@/lib/visitors";

type Event = VisitInput extends infer E ? (E extends { path: string } ? Omit<E, "path"> : never) : never;

const readCookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];
const randomId = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, "-").replace(/\//g, "_");

/** Keeps (or makes) this browser's visitor id for a year and its visit id for 30 minutes after the last event. */
function keepVisitIds() {
  const flags = `; path=/; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  const keep = (name: string, maxAge: number) => {
    const known = readCookie(name);
    document.cookie = `${name}=${isVisitId(known) ? known : randomId()}; max-age=${maxAge}${flags}`;
  };
  keep(VISITOR_COOKIE, 365 * 86400);
  keep(VISIT_SESSION_COOKIE, SESSION_MINUTES * 60);
}

/** One anonymous analytics event (app/api/visit). sendBeacon survives the page leaving and never slows it. Never throws. */
export function sendVisit(e: Event) {
  try {
    keepVisitIds();
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
