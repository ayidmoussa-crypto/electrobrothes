// Content-Security-Policy for every page, used by next.config.ts. Pure, so it is tested.
//
// Why 'unsafe-inline' for scripts: Next streams each page with small inline <script> tags, and the three
// pixels are inline snippets. Allowing them by nonce would make every page render per request, which
// turns off the prebuilt pages of `cacheComponents` and slows the shop. Without a nonce, this policy
// still blocks plugins, <base> hijacking, framing by other sites (clickjacking), forms posting elsewhere,
// and scripts, frames and data requests to any domain not listed here.

const CLOUDINARY = ["https://res.cloudinary.com", "https://api.cloudinary.com"];
const TURNSTILE = "https://challenges.cloudflare.com";
const META = ["https://connect.facebook.net", "https://www.facebook.com"];
const GOOGLE = ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.google.com"];
const TIKTOK = ["https://analytics.tiktok.com", "https://*.tiktok.com"];
// Sentry's ingest hosts: o<org>.ingest.sentry.io, o<org>.ingest.de.sentry.io, o<org>.ingest.us.sentry.io.
const SENTRY = "https://*.sentry.io";

/**
 * Sentry's CSP report address, made from the DSN: "https://KEY@HOST/PROJECT" gives
 * "https://HOST/api/PROJECT/security/?sentry_key=KEY". Null when there is no valid DSN.
 */
export function sentryCspReportUri(dsn: string | undefined) {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+|\/+$/g, "");
    if (u.protocol !== "https:" || !u.username || !/^\d+$/.test(project)) return null;
    return `https://${u.host}/api/${project}/security/?sentry_key=${u.username}`;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ dev = false, reportUri = null as string | null } = {}) {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-eval' only in `next dev` (React's dev tools need it), never in production.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), TURNSTILE, ...META, ...GOOGLE, ...TIKTOK],
    // framer-motion and next/font set inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...CLOUDINARY, ...META, ...GOOGLE, ...TIKTOK],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:", ...CLOUDINARY],
    // Admin photo uploads go straight to Cloudinary; the pixels and Sentry send their data here.
    "connect-src": ["'self'", ...CLOUDINARY, TURNSTILE, ...META, ...GOOGLE, ...TIKTOK, SENTRY, ...(dev ? ["ws:"] : [])],
    // Turnstile draws its check in an iframe.
    "frame-src": [TURNSTILE],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
  };
  if (reportUri) directives["report-uri"] = [reportUri];
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}
