import "server-only";
import { randomBytes } from "node:crypto";
import { CHANNEL_COOKIE, decodeTouch } from "./attribution";
import { db } from "./db";
import { SESSION_COOKIE as ADMIN_COOKIE } from "./session";
import { cityOf, cleanPath, deviceOf, isBot, isVisitId, SESSION_MINUTES, VISIT_RETENTION_DAYS, VISIT_SESSION_COOKIE, VISITOR_COOKIE } from "./visitors";

type Jar = { get(name: string): { value: string } | undefined; set(name: string, value: string, options: object): unknown };
type Headers = { get(name: string): string | null };

const newId = () => randomBytes(18).toString("base64url");
const cookie = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge, path: "/" });

/**
 * Who is acting, for analytics only: the visitor and visit ids (created on the first event and renewed on each one,
 * so a visit ends after 30 minutes without activity), where they came from, device and city. Returns null for
 * robots and for the shop's own team, who are never counted.
 */
export function visitContext(jar: Jar, headers: Headers) {
  const ua = headers.get("user-agent");
  if (isBot(ua) || jar.get(ADMIN_COOKIE)) return null;
  const known = jar.get(VISITOR_COOKIE)?.value;
  const visitorId = isVisitId(known) ? known : newId();
  const current = jar.get(VISIT_SESSION_COOKIE)?.value;
  const sessionId = isVisitId(current) ? current : newId();
  jar.set(VISITOR_COOKIE, visitorId, cookie(365 * 86400));
  jar.set(VISIT_SESSION_COOKIE, sessionId, cookie(SESSION_MINUTES * 60));
  return {
    visitorId,
    sessionId,
    isNew: !isVisitId(known),
    channel: decodeTouch(jar.get(CHANNEL_COOKIE)?.value)?.channel ?? "DIRECT",
    device: deviceOf(ua),
    city: cityOf(headers.get("x-vercel-ip-city")),
    country: headers.get("x-vercel-ip-country")?.slice(0, 2) || null,
  };
}

export type VisitContext = NonNullable<ReturnType<typeof visitContext>>;

/** Writes one event. Never throws: analytics must not break a page or an order. Sweeps expired events now and then. */
export async function recordVisit(
  ctx: VisitContext,
  e: { type: string; path?: string | null; productId?: string | null; query?: string | null; results?: number | null; value?: number | null; orderId?: string | null },
) {
  try {
    await db.visitEvent.create({ data: { ...ctx, ...e, path: e.path ? cleanPath(e.path) : null } });
    if (Math.random() < 0.002) {
      await db.visitEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - VISIT_RETENTION_DAYS * 86_400_000) } } });
    }
  } catch (error) {
    console.error("[visits] could not record", e.type, error instanceof Error ? error.message : "");
  }
}
