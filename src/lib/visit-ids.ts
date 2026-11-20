// Visitor and visit ids, shared by the browser (which creates them) and the server (which only reads them).
// Kept free of dependencies so the shop's pages stay light.

/**
 * Made by the browser, not set by the server: some phones (Safari) drop cookies sent back on a background
 * sendBeacon answer, which turned every event into a new visitor. New names, because a browser may still hold
 * the old server-only (httpOnly) cookies, which page scripts can neither read nor replace.
 */
export const VISITOR_COOKIE = "eb_v";
export const VISIT_SESSION_COOKIE = "eb_s";
/** Cookies the first version set from the server; removed when seen. */
export const LEGACY_VISIT_COOKIES = ["eb_vid", "eb_sid"] as const;
/** A visit ends after this much inactivity. */
export const SESSION_MINUTES = 30;

export const isVisitId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{16,40}$/.test(v);
