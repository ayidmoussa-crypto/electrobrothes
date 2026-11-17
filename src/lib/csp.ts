// Content-Security-Policy for every page, used by next.config.ts. Pure, so it is tested.
//
// Why 'unsafe-inline' for scripts: Next streams each page with small inline <script> tags, and the three
// pixels are inline snippets. Allowing them by nonce would make every page render per request, which
// turns off the prebuilt pages of `cacheComponents` and slows the shop. Without a nonce, this policy
// still blocks plugins, <base> hijacking, framing by other sites (clickjacking), forms posting elsewhere,
// and scripts, frames and data requests to any domain not listed here.
// A new third-party widget needs its domain here first, or the browser blocks it.

const CLOUDINARY = ["https://res.cloudinary.com", "https://api.cloudinary.com"];
const TURNSTILE = "https://challenges.cloudflare.com";
const META = ["https://connect.facebook.net", "https://www.facebook.com"];
const GOOGLE = ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.google.com"];
const TIKTOK = ["https://analytics.tiktok.com", "https://*.tiktok.com"];

export function contentSecurityPolicy({ dev = false } = {}) {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-eval' only in `next dev` (React's dev tools need it), never in production.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), TURNSTILE, ...META, ...GOOGLE, ...TIKTOK],
    // motion and next/font set inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Any https picture: the owner can paste a picture link from anywhere in the admin. A picture runs no code.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:", ...CLOUDINARY],
    // Admin photo uploads go straight to Cloudinary; the pixels send their data here.
    "connect-src": ["'self'", ...CLOUDINARY, TURNSTILE, ...META, ...GOOGLE, ...TIKTOK, ...(dev ? ["ws:"] : [])],
    // Turnstile draws its check in an iframe.
    "frame-src": [TURNSTILE],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    ...(dev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([k, v]) => [k, ...v].join(" "))
    .join("; ");
}
