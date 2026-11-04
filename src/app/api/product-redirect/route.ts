import type { NextRequest } from "next/server";
import { getProduct, getSlugRedirect } from "@/lib/catalog";

// Used by the proxy, which keeps the database out of its own bundle. Public data: whether a product
// exists and where it moved. A live product wins over an old address, as it does on the page.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.slice(0, 200) ?? "";
  const exists = slug ? (await getProduct(slug)) !== null : false;
  return Response.json({ exists, to: slug && !exists ? await getSlugRedirect(slug) : null });
}
