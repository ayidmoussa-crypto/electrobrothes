import type { NextRequest } from "next/server";
import { getSlugRedirect } from "@/lib/catalog";

// Used by the proxy, which keeps the database out of its own bundle. Public data: where a product moved.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.slice(0, 200) ?? "";
  return Response.json({ to: slug ? await getSlugRedirect(slug) : null });
}
