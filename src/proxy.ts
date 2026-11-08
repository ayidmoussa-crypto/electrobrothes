import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { CHANNEL_COOKIE, CHANNEL_MAX_AGE, decodeTouch, detectTouch, encodeTouch, nextTouch } from "./lib/attribution";
import { missingPagePath, movedProductPath } from "./lib/seo-content/slug";

const intl = createMiddleware(routing);

// Search engines need a real 404 and a real permanent redirect, and a streamed page can send neither:
// its 200 is already out when it learns the product or category is missing. So the answer is decided here.
export default async function proxy(request: NextRequest) {
  return remember(request, await route(request));
}

/**
 * Keeps where the visitor came from (Instagram, Google...) for the order to pick up at checkout. Only real
 * page loads count: in-app navigation and prefetches carry the shop itself as their origin.
 */
function remember(request: NextRequest, response: NextResponse) {
  // Next hides its own flight headers from the proxy, so a client navigation is told apart by what the
  // browser says it is fetching: anything but a document.
  const dest = request.headers.get("sec-fetch-dest");
  if (request.method !== "GET" || (dest && dest !== "document")) return response;
  const visit = detectTouch(request.nextUrl, request.headers.get("referer"), request.headers.get("host")?.split(":")[0] ?? request.nextUrl.hostname);
  const next = nextTouch(decodeTouch(request.cookies.get(CHANNEL_COOKIE)?.value), visit);
  if (next) {
    response.cookies.set(CHANNEL_COOKIE, encodeTouch(next), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: CHANNEL_MAX_AGE,
      path: "/",
    });
  }
  return response;
}

async function route(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^(\/en)?\/(products|category)\/([^/]+)$/);
  if (match) {
    const prefix = match[1] ?? "";
    const lookup = match[2] === "products" ? "product-redirect" : "category-exists";
    try {
      const slug = decodeURIComponent(match[3]);
      const res = await fetch(new URL(`/api/${lookup}?slug=${encodeURIComponent(slug)}`, request.nextUrl.origin), { signal: AbortSignal.timeout(5000) });
      const { exists, to } = (await res.json()) as { exists: boolean; to?: string | null };
      if (to) return NextResponse.redirect(new URL(movedProductPath(prefix, to), request.nextUrl.origin), 308);
      if (exists === false) return NextResponse.rewrite(new URL(missingPagePath(prefix), request.nextUrl.origin));
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
