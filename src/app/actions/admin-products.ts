"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { PRODUCT_ERRORS, productInput } from "@/lib/product-input";

export type ProductFormState = { ok?: boolean; message?: string; errors?: string[] };

// updateTag (not revalidateTag): the very next storefront visit already shows the edit.
function refreshStorefront(slug?: string) {
  updateTag("products");
  if (slug) updateTag(`product:${slug}`);
  revalidatePath("/admin/products");
}

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin();
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
    // Moroccan local time (UTC+1).
    dealEndsAt: p.dealEndsAt ? new Date(`${p.dealEndsAt}:00+01:00`) : null,
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

      // Variants are updated in place (order history keeps pointing at them); removed ones are deleted.
      const keep = p.variants.map((v) => v.id).filter((v): v is string => !!v);
      await tx.variant.deleteMany({ where: { productId: id, id: { notIn: keep } } });
      for (const [i, { id: variantId, ...v }] of p.variants.entries()) {
        const row = { ...v, productId: id!, isDefault: i === 0, sortOrder: i };
        if (variantId) await tx.variant.update({ where: { id: variantId, productId: id }, data: row });
        else await tx.variant.create({ data: row });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      return { ok: false, message: target.includes("sku") ? "رمز SKU مستعمل في منتج آخر." : "هذا الرابط (slug) مستعمل في منتج آخر." };
    }
    throw e;
  }

  refreshStorefront(p.slug);
  if (!p.id) redirect(`/admin/products/${id}?created=1`);
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
