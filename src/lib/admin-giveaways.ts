import "server-only";
import type { GiveawayProductOption } from "@/components/admin/GiveawayEditor";
import { db } from "./db";

/** Shop products the owner can give away, with their first photo. */
export async function giveawayProductOptions(): Promise<GiveawayProductOption[]> {
  const rows = await db.product.findMany({
    where: { isActive: true },
    select: { id: true, nameAr: true, nameEn: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { nameAr: "asc" },
  });
  return rows.map((p) => ({ id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, image: p.images[0]?.url ?? null }));
}
