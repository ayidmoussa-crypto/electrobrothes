import { cacheLife, cacheTag } from "next/cache";
import { GSC_TOKEN_URL, gscConfig, gscPeriods, serviceAccountAssertion, totalsOf, type GscConfig, type GscRow } from "./gsc-rules";

// Google Search Console for the admin SEO page: clicks, impressions, position, top searches and pages.
// A Google service account reads the property once it is added as a user of that property in Search Console.

export class GscError extends Error {
  constructor(
    readonly kind: "auth" | "access" | "api",
    message: string,
  ) {
    super(message);
  }
}

async function accessToken(c: GscConfig) {
  const res = await fetch(GSC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountAssertion(c) }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string; error_description?: string } | null;
  if (!res.ok || !data?.access_token) throw new GscError("auth", data?.error_description ?? `token ${res.status}`);
  return data.access_token;
}

async function query(c: GscConfig, token: string, body: Record<string, unknown>): Promise<GscRow[]> {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(c.site)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  // 403: the service account is not a user of the property; 404: no such property.
  if (res.status === 403 || res.status === 404) throw new GscError("access", `property ${res.status}`);
  if (!res.ok) throw new GscError("api", `query ${res.status}`);
  return ((await res.json()) as { rows?: GscRow[] }).rows ?? [];
}

/** The last 28 days and the 28 before. Cached for hours: Search Console only updates about once a day. */
async function loadGsc(c: GscConfig) {
  "use cache";
  cacheLife("hours");
  cacheTag("gsc");
  const { current, previous } = gscPeriods();
  const token = await accessToken(c);
  const [now, before, queries, pages] = await Promise.all([
    query(c, token, { ...current }),
    query(c, token, { ...previous }),
    query(c, token, { ...current, dimensions: ["query"], rowLimit: 5 }),
    query(c, token, { ...current, dimensions: ["page"], rowLimit: 5 }),
  ]);
  const top = (rows: GscRow[]) => rows.map((r) => ({ key: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions, position: r.position }));
  return { period: current, totals: totalsOf(now), previous: totalsOf(before), queries: top(queries), pages: top(pages) };
}

export type GscReport = Awaited<ReturnType<typeof loadGsc>>;
export type GscResult = { status: "off" } | { status: "error"; kind: GscError["kind"] } | { status: "ok"; report: GscReport };

/** Never throws: the SEO page shows the card in whatever state the link is. Errors are not cached. */
export async function searchConsole(): Promise<GscResult> {
  const c = gscConfig();
  if (!c) return { status: "off" };
  try {
    return { status: "ok", report: await loadGsc(c) };
  } catch (e) {
    console.error("[gsc]", e instanceof Error ? e.message : e);
    return { status: "error", kind: e instanceof GscError ? e.kind : "api" };
  }
}
