import "server-only";
import { db } from "./db";
import type { ProductInput } from "./product-input";

export async function editorOptions() {
  const [categories, brands] = await Promise.all([
    db.category.findMany({ select: { id: true, nameAr: true }, orderBy: { sortOrder: "asc" } }),
    db.brand.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, label: c.nameAr })),
    brands: brands.map((b) => ({ id: b.id, label: b.name })),
    uploadsEnabled: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
  };
}

/** Date → "YYYY-MM-DDTHH:mm" in Moroccan time (UTC+1) for <input type="datetime-local">. */
const toLocalInput = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 16);

export async function productForEditor(id: string): Promise<ProductInput | null> {
  const p = await db.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { sortOrder: "asc" } }, specs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    descriptionAr: p.descriptionAr,
    descriptionEn: p.descriptionEn,
    categoryId: p.categoryId,
    brandId: p.brandId,
    warrantyMonths: p.warrantyMonths,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isBestSeller: p.isBestSeller,
    dealEndsAt: p.dealEndsAt ? toLocalInput(p.dealEndsAt) : null,
    costPrice: p.costPrice ?? "",
    images: p.images.map((i) => ({ url: i.url, altAr: i.altAr, altEn: i.altEn })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      colorAr: v.colorAr ?? "",
      colorEn: v.colorEn ?? "",
      colorHex: v.colorHex ?? "",
      storage: v.storage ?? "",
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? "",
      costPrice: v.costPrice ?? "",
      stock: v.stock,
      stockBase: v.stock,
      lowStockAt: v.lowStockAt,
    })),
    specs: p.specs.map((s) => ({ key: s.key, valueAr: s.valueAr, valueEn: s.valueEn, numericValue: s.numericValue ?? "" })),
  };
}

export const emptyProduct = (): ProductInput => ({
  slug: "",
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  categoryId: "",
  brandId: "",
  warrantyMonths: 12,
  isActive: true,
  isFeatured: false,
  isBestSeller: false,
  dealEndsAt: null,
  costPrice: "",
  images: [],
  variants: [{ sku: "", colorAr: "", colorEn: "", colorHex: "", storage: "", price: "", compareAtPrice: "", costPrice: "", stock: 0, stockBase: 0, lowStockAt: 3 }],
  specs: [],
});

/** Latest stock moves of a product, newest first, for the editor's history table. */
export function stockHistory(productId: string, take = 60) {
  return db.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, createdAt: true, colorLabel: true, sku: true, delta: true, stockAfter: true, reason: true, unitCost: true, orderId: true, orderNumber: true, actor: true, note: true },
  });
}
