import "server-only";
import { headers } from "next/headers";
import { pickClientIp } from "./client-ip";
import { db } from "./db";

/** The visitor rate limits count (lib/client-ip.ts): the edge-set address first, IPv6 grouped by /64. */
export async function clientIp() {
  const h = await headers();
  return pickClientIp((name) => h.get(name));
}

/**
 * Fixed-window counter in Postgres, atomic under concurrency (single upsert).
 * Returns the count in the current window including this hit.
 */
export async function hit(key: string, windowSeconds: number) {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  // One key per visitor IP and per email: without this the table only grows. About one call in 200
  // sweeps the rows whose window ended a day ago; a failure there never blocks the caller.
  if (Math.random() < 0.005) {
    db.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`.catch(() => {});
  }
  return rows[0].count;
}

/**
 * Cloudflare Turnstile check. Skipped (returns true) when no secret is configured,
 * so local development works without keys.
 */
export async function verifyTurnstile(token: string | null, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    // Cloudflare unreachable: do not lose the sale, the order is still risk-scored and called.
    return true;
  }
}
