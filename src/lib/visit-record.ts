import "server-only";
import { CHANNEL_COOKIE, decodeTouch } from "./attribution";
import { db } from "./db";
import { SESSION_COOKIE as ADMIN_COOKIE } from "./session";
import { cityOf, cleanPath, deviceOf, isBot, isVisitId, VISIT_RETENTION_DAYS, VISIT_SESSION_COOKIE, VISITOR_COOKIE } from "./visitors";

type Jar = { get(name: string): { value: string } | undefined };
type Headers = { get(name: string): string | null };

/**
 * Who is acting, for analytics only: the visitor and visit ids the shop's pages created (VisitTracker), where they
 * came from, device and city. Returns null for robots, for the shop's own team (never counted) and when the
 * browser sent no ids: without them one person would count as many visitors.
 */
export function visitContext(jar: Jar, headers: Headers) {
  const ua = headers.get("user-agent");
  if (isBot(ua) || jar.get(ADMIN_COOKIE)) return null;
  const visitorId = jar.get(VISITOR_COOKIE)?.value;
  const sessionId = jar.get(VISIT_SESSION_COOKIE)?.value;
  if (!isVisitId(visitorId) || !isVisitId(sessionId)) return null;
  return {
    visitorId,
    sessionId,
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
