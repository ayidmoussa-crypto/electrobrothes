import { createSign } from "node:crypto";

// Pure parts of the Search Console link (lib/gsc.ts): settings, dates, the signed assertion, totals. Tested.

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GSC_TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Search Console data arrives about two days late: the window ends three days ago so it is complete. */
const LAG_DAYS = 3;
export const GSC_DAYS = 28;

export type GscConfig = { email: string; key: string; site: string };

/** GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY and GSC_SITE ("sc-domain:example.ma" or "https://example.ma/"); null while one is missing. */
export function gscConfig(env: Record<string, string | undefined> = process.env): GscConfig | null {
  const email = env.GSC_CLIENT_EMAIL?.trim();
  // Vercel and .env files keep the key on one line with literal "\n".
  const key = env.GSC_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const site = env.GSC_SITE?.trim();
  return email && key && site ? { email, key, site } : null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The last full window and the one before it, as Search Console dates (UTC). */
export function gscPeriods(now = new Date(), days = GSC_DAYS) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - LAG_DAYS));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  return { current: { startDate: day(start), endDate: day(end) }, previous: { startDate: day(prevStart), endDate: day(prevEnd) } };
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** A signed service-account assertion (JWT, RS256), exchanged for an access token. */
export function serviceAccountAssertion(c: Pick<GscConfig, "email" | "key">, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: c.email, scope: GSC_SCOPE, aud: GSC_TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(c.key);
  return `${header}.${claims}.${b64url(signature)}`;
}

export type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
export type GscTotals = { clicks: number; impressions: number; ctr: number; position: number | null };

/** Totals of one window; position is null when the site was never shown. */
export function totalsOf(rows: GscRow[]): GscTotals {
  const r = rows[0];
  return r ? { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.impressions ? r.position : null } : { clicks: 0, impressions: 0, ctr: 0, position: null };
}

/** Change against the window before, in whole percent; null with nothing to compare. */
export const gscChange = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
