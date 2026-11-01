import type { NextRequest } from "next/server";
import { searchProducts } from "@/lib/catalog";

// Instant-search suggestions for the header box. Read-only and cached per query in searchProducts.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return Response.json({ items: [] });

  const items = (await searchProducts(q, 6)).map((p) => ({
    slug: p.slug,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    brand: p.brand,
    price: p.minPrice,
    image: p.image?.url ?? null,
  }));
  return Response.json({ items }, { headers: { "Cache-Control": "public, max-age=60" } });
}
