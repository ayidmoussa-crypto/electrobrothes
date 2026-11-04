import type { NextRequest } from "next/server";
import { getCategory } from "@/lib/catalog";

// Used by the proxy, which keeps the database out of its own bundle. Public data: whether a category exists.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.slice(0, 200) ?? "";
  return Response.json({ exists: slug ? (await getCategory(slug)) !== null : false });
}
