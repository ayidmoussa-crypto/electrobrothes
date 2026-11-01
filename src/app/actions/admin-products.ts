"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { PRODUCT_ERRORS, productInput } from "@/lib/product-input";
import { rescoreProducts } from "@/lib/seo-content/score";
import { InsufficientStockError, moveStock } from "@/lib/stock";
import { moroccanDate } from "@/lib/time";

export type ProductFormState = { ok?: boolean; message?: string; errors?: string[] };

// updateTag (not revalidateTag): the very next storefront visit already shows the edit.
function refreshStorefront(slug?: string) {
  updateTag("products");
  if (slug) updateTag(`product:${slug}`);
  revalidatePath("/admin/products");
}

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const admin = await requireAdmin();
  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, message: "بيانات غير صالحة." };
  }
  const parsed = productInput.safeParse(json);
  if (!parsed.success) {
    const errors = [...new Set(parsed.error.issues.map((i) => PRODUCT_ERRORS[i.message] ?? i.message))];
    return { ok: false, message: "يرجى تصحيح الأخطاء.", errors };
  }
  const p = parsed.data;
  const data = {
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
    // Moroccan local time.
    dealEndsAt: p.dealEndsAt ? moroccanDate(`${p.dealEndsAt}:00`) : null,
    costPrice: p.costPrice,
  };

  let id = p.id;
  try {
    await db.$transaction(async (tx) => {
      const product = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data });
      id = product.id;

      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({ data: p.images.map((img, i) => ({ ...img, productId: id!, sortOrder: i })) });

      await tx.spec.deleteMany({ where: { productId: id } });
      await tx.spec.createMany({ data: p.specs.map((s, i) => ({ ...s, productId: id!, sortOrder: i })) });

      // Colours are updated in place (order history keeps pointing at them). Quantities never get written
      // directly: the editor's change (stock − stockBase) goes through moveStock, so it is logged and an
      // order confirmed while the editor was open is not overwritten.
      const keep = p.variants.map((v) => v.id).filter((v): v is string => !!v);
      const removed = await tx.variant.findMany({ where: { productId: id, id: { notIn: keep } }, select: { id: true, stock: true } });
      for (const r of removed.filter((r) => r.stock > 0)) {
        await moveStock(tx, { variantId: r.id, delta: -r.stock, reason: "ADJUSTMENT", actor: admin.email, note: "حذف اللون" });
      }
      await tx.variant.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });

      for (const [i, { id: variantId, stock, stockBase, ...v }] of p.variants.entries()) {
        const row = { ...v, productId: id!, isDefault: i === 0, sortOrder: i };
        const saved = variantId
          ? await tx.variant.update({ where: { id: variantId, productId: id }, data: row })
          : await tx.variant.create({ data: { ...row, stock: 0 } });
        const delta = stock - (variantId ? stockBase : 0);
        if (delta) await moveStock(tx, { variantId: saved.id, delta, reason: delta > 0 ? "STOCK_IN" : "ADJUSTMENT", actor: admin.email });
      }
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { ok: false, message: `لا يمكن إنقاص مخزون ${e.sku} أكثر من الكمية المتوفرة الآن. حدّث الصفحة وأعد المحاولة.` };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      return { ok: false, message: target.includes("sku") ? "رمز SKU مستعمل في منتج آخر." : "هذا الرابط (slug) مستعمل في منتج آخر." };
    }
    throw e;
  }

  await rescoreProducts([id!]);
  refreshStorefront(p.slug);
  if (!p.id) redirect(`/admin/products/${id}?created=1`);
  // Reload the editor so stock and its base reflect the saved state (and the history shows the moves).
  revalidatePath(`/admin/products/${id}`);
  return { ok: true, message: "تم حفظ المنتج." };
}

export async function deleteProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "طلب غير صالح." };
  const product = await db.product.findUnique({ where: { id: id.data }, select: { slug: true } });
  if (!product) return { ok: false, message: "المنتج غير موجود." };
  // Orders keep their own snapshot (name, SKU, price), so deleting a product never rewrites history.
  await db.product.delete({ where: { id: id.data } });
  refreshStorefront(product.slug);
  redirect("/admin/products");
}
