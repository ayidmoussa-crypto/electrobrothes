import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { contentSecurityPolicy, sentryCspReportUri } from "./src/lib/csp";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Baseline security headers for every response.
// The CSP is in report-only mode: the browser reports what it would block (console, and Sentry when
// SENTRY_DSN is set) but blocks nothing. Switching it on = renaming the header to
// "Content-Security-Policy" once a week of reports shows nothing legitimate is caught (README.md).
// A new third-party widget needs its domain in src/lib/csp.ts first.
const csp = contentSecurityPolicy({ dev: process.env.NODE_ENV !== "production", reportUri: sentryCspReportUri(process.env.SENTRY_DSN) });
const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The back office is never cached by shared caches or indexed.
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  partialPrefetching: true,
  images: {
    // Product photos uploaded from the admin (Cloudinary). Served as WebP at the size each screen needs.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    formats: ["image/webp"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
