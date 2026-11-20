import { z } from "zod";

// Visitor analytics: pure rules (no database, no request), so they can be tested directly.

export { isVisitId, LEGACY_VISIT_COOKIES, SESSION_MINUTES, VISIT_SESSION_COOKIE, VISITOR_COOKIE } from "./visit-ids";
/** Detailed events are deleted after this many days; the visitors page cannot look further back. */
export const VISIT_RETENTION_DAYS = 90;
/** Events accepted per address per hour: a normal visit sends a few dozen at most. */
export const VISIT_EVENTS_PER_HOUR = 600;

/** What the shop's pages may report. order_placed is written by the server only, never accepted from the browser. */
export const visitInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page_view"), path: z.string().startsWith("/").max(200) }),
  z.object({ type: z.literal("product_view"), path: z.string().startsWith("/").max(200), productId: z.string().min(1).max(40) }),
  z.object({ type: z.literal("add_to_cart"), path: z.string().startsWith("/").max(200), variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal("checkout_start"), path: z.string().startsWith("/").max(200) }),
  z.object({ type: z.literal("search"), path: z.string().startsWith("/").max(200), query: z.string().trim().min(1).max(80), results: z.number().int().min(0).max(1000) }),
]);
export type VisitInput = z.infer<typeof visitInput>;

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http/i;

/** Robots, link previews and scripts are not visitors. A missing user agent is not a browser either. */
export const isBot = (userAgent: string | null | undefined) => !userAgent || BOT.test(userAgent);

/** Phone, tablet or computer, from the user agent. */
export function deviceOf(userAgent: string | null | undefined): "mobile" | "tablet" | "desktop" {
  const ua = userAgent ?? "";
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

/** Vercel sends the city URL-encoded ("Casablanca", "F%C3%A8s"); anything odd is dropped. */
export function cityOf(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const city = decodeURIComponent(raw).trim().slice(0, 60);
    return /^[\p{L}\p{M} .'-]+$/u.test(city) ? city : null;
  } catch {
    return null;
  }
}


/** Shop paths only, without the query string: "/en/products/x?utm=..." becomes "/en/products/x". */
export const cleanPath = (path: string) => path.split(/[?#]/)[0].slice(0, 200) || "/";

// ───────── Reading the figures ─────────

export type FunnelCounts = { sessions: number; productViews: number; carts: number; checkouts: number; orders: number; confirmed: number; delivered: number };

/** Each step as a count and as a share of all visits, plus the share kept from the step before. */
export function funnelSteps(c: FunnelCounts) {
  const steps = [
    ["sessions", c.sessions],
    ["productViews", c.productViews],
    ["carts", c.carts],
    ["checkouts", c.checkouts],
    ["orders", c.orders],
    ["confirmed", c.confirmed],
    ["delivered", c.delivered],
  ] as const;
  return steps.map(([key, count], i) => ({
    key,
    count,
    ofVisits: c.sessions ? Math.round((count / c.sessions) * 1000) / 10 : 0,
    fromPrevious: i === 0 ? 100 : steps[i - 1][1] ? Math.round((count / steps[i - 1][1]) * 1000) / 10 : 0,
  }));
}

/** Share in percent with one decimal, 0 when there is nothing to divide by. */
export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
