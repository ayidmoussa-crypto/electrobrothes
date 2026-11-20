import { after, NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, hit } from "@/lib/guard";
import { recordVisit, visitContext } from "@/lib/visit-record";
import { LEGACY_VISIT_COOKIES, VISIT_EVENTS_PER_HOUR, visitInput } from "@/lib/visitors";

const MAX_BODY = 2000;

/**
 * Anonymous shop analytics (lib/visitors.ts). Always answers 204 so a page never waits on it or learns anything;
 * bad, oversized, robot, team or over-limit events are silently dropped. The write happens after the answer.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  // Only the shop itself sends these (sendBeacon from its own pages).
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return done;
  if (request.headers.get("sec-purpose")?.includes("prefetch")) return done;

  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return done;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return done;
  }
  const parsed = visitInput.safeParse(body);
  if (!parsed.success) return done;

  for (const name of LEGACY_VISIT_COOKIES) if (request.cookies.has(name)) done.cookies.delete(name);
  const ctx = visitContext(request.cookies, request.headers);
  if (!ctx) return done;
  const e = parsed.data;
  const ip = await clientIp();

  after(async () => {
    if ((await hit(`visit:ip:${ip}`, 3600)) > VISIT_EVENTS_PER_HOUR) return;
    if (e.type === "product_view") {
      // Only real, shown products: no junk ids in the figures.
      const product = await db.product.findFirst({ where: { id: e.productId, isActive: true }, select: { id: true } });
      if (product) await recordVisit(ctx, { type: e.type, path: e.path, productId: product.id });
    } else if (e.type === "add_to_cart") {
      // Price and product come from the catalog, never from the browser.
      const v = await db.variant.findFirst({ where: { id: e.variantId, product: { isActive: true } }, select: { price: true, productId: true } });
      if (v) await recordVisit(ctx, { type: e.type, path: e.path, productId: v.productId, value: v.price * e.qty });
    } else if (e.type === "search") {
      await recordVisit(ctx, { type: e.type, path: e.path, query: e.query.toLowerCase(), results: e.results });
    } else {
      await recordVisit(ctx, { type: e.type, path: e.path });
    }
  });
  return done;
}
