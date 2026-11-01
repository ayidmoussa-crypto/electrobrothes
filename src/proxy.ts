import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isCleanSlug, movedProductPath } from "./lib/seo-content/slug";

const intl = createMiddleware(routing);

// Search engines need a real permanent redirect, which a streamed page cannot send. Only a slug that
// is not clean can be an old address (only those get moved), so normal product visits never pay for this.
export default async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^(\/en)?\/products\/([^/]+)$/);
  const slug = match ? decodeURIComponent(match[2]) : null;
  if (slug && !isCleanSlug(slug)) {
    try {
      const res = await fetch(new URL(`/api/product-redirect?slug=${encodeURIComponent(slug)}`, request.nextUrl.origin), { signal: AbortSignal.timeout(2000) });
      const { to } = (await res.json()) as { to: string | null };
      if (to) return NextResponse.redirect(new URL(movedProductPath(match![1] ?? "", to), request.nextUrl.origin), 308);
    } catch {
      // The page itself still redirects in the browser.
    }
  }
  return intl(request);
}

export const config = {
  // Skip API routes, the (Arabic-only) admin, Next internals and any file with an extension.
  matcher: "/((?!api|admin|_next|_vercel|.*\\..*).*)",
};
