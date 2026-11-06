import "server-only";
import type { BundleProductOption } from "@/components/admin/BundleForm";
import { db } from "./db";

/** Products the owner can put in a pack: the ones shown in the shop. */
export async function bundleProductOptions(): Promise<BundleProductOption[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, variants: { some: {} } },
    select: {
      id: true,
      nameAr: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { select: { price: true, stock: true } },
    },
    orderBy: { nameAr: "asc" },
  });
  return rows.map((p) => {
    const inStock = p.variants.filter((v) => v.stock > 0);
    return {
      id: p.id,
      nameAr: p.nameAr,
      minPrice: Math.min(...(inStock.length ? inStock : p.variants).map((v) => v.price)),
      stock: p.variants.reduce((s, v) => s + v.stock, 0),
      image: p.images[0]?.url ?? null,
    };
  });
}

export const uploadsEnabled = () => !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
