import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { missingProductPath, movedProductPath } from "./lib/seo-content/slug";

const intl = createMiddleware(routing);

// Search engines need a real 404 and a real permanent redirect, and a streamed page can send neither:
// its 200 is already out when it learns the product is missing. So the answer is decided here.
export default async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^(\/en)?\/products\/([^/]+)$/);
  if (match) {
    const prefix = match[1] ?? "";
    try {
      const slug = decodeURIComponent(match[2]);
      const res = await fetch(new URL(`/api/product-redirect?slug=${encodeURIComponent(slug)}`, request.nextUrl.origin), { signal: AbortSignal.timeout(5000) });
      const { exists, to } = (await res.json()) as { exists: boolean; to: string | null };
      if (to) return NextResponse.redirect(new URL(movedProductPath(prefix, to), request.nextUrl.origin), 308);
      if (exists === false) return NextResponse.rewrite(new URL(missingProductPath(prefix), request.nextUrl.origin));
    } catch {
      // The page itself still shows the 404 or redirects in the browser.
    }
  }
  return intl(request);
}

export const config = {
  // Skip API routes, the (Arabic-only) admin, Next internals and any file with an extension.
  matcher: "/((?!api|admin|_next|_vercel|.*\\..*).*)",
};
