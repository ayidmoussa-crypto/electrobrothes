"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { slugify } from "@/lib/product-input";

type State = { ok?: boolean; message?: string };

const items = z.string().transform((s, ctx) => {
  try {
    return z
      .array(z.object({ productId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(10) }))
      .min(1)
      .max(8)
      .parse(JSON.parse(s));
  } catch {
    ctx.addIssue({ code: "custom", message: "items" });
    return z.NEVER;
  }
});

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((s) => s || null);

const bundleInput = z.object({
  id: z.string().max(40).optional().transform((v) => v || undefined),
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  taglineAr: optionalText(200),
  taglineEn: optionalText(200),
  image: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((s) => s || null)
    .refine((s) => s === null || /^https:\/\//.test(s), "image"),
  price: z.coerce.number().int().min(1).max(1_000_000),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  items,
});

function done(slug?: string) {
  revalidatePath("/admin/bundles");
  updateTag("bundles");
  if (slug) updateTag(`bundle:${slug}`);
}

export async function saveBundle(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const parsed = bundleInput.safeParse(Object.fromEntries([...fd].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) {
    const items = parsed.error.issues.some((i) => i.path[0] === "items");
    return { ok: false, message: items ? "زيد على الأقل منتج واحد للباك." : "تحقق من الحقول المطلوبة." };
  }
  const { id, items: list, ...b } = parsed.data;
  if (new Set(list.map((i) => i.productId)).size !== list.length) return { ok: false, message: "نفس المنتج مكرر: بدّل الكمية بلاصة ما تزيدو مرتين." };
  const slug = slugify(b.slug || b.nameEn);
  if (!slug) return { ok: false, message: "تحقق من الرابط (slug)." };

  // The pack has to be cheaper than its products bought one by one, or it saves the customer nothing.
  const products = await db.product.findMany({ where: { id: { in: list.map((i) => i.productId) } }, select: { id: true, variants: { select: { price: true } } } });
  if (products.length !== list.length) return { ok: false, message: "واحد من المنتجات ما بقاش موجود." };
  const separate = list.reduce((s, i) => s + Math.min(...products.find((p) => p.id === i.productId)!.variants.map((v) => v.price)) * i.quantity, 0);
  if (b.price >= separate) return { ok: false, message: `ثمن الباك خاصو يكون أقل من ${separate} درهم (ثمن المنتجات بالتفريق).` };

  const data = { ...b, slug };
  const rows = list.map((i, n) => ({ productId: i.productId, quantity: i.quantity, sortOrder: n }));
  let savedId: string;
  try {
    if (id) {
      await db.$transaction([
        db.bundleItem.deleteMany({ where: { bundleId: id } }),
        db.bundle.update({ where: { id }, data: { ...data, items: { create: rows } } }),
      ]);
      savedId = id;
    } else {
      savedId = (await db.bundle.create({ data: { ...data, items: { create: rows } }, select: { id: true } })).id;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: "هاد الرابط (slug) مستعمل فباك آخر." };
    throw e;
  }
  done(slug);
  if (!id) redirect(`/admin/bundles/${savedId}?saved=1`);
  return { ok: true, message: "تم الحفظ." };
}

export async function deleteBundle(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const b = await db.bundle.delete({ where: { id }, select: { slug: true } }).catch(() => null);
  if (!b) return { ok: false, message: "ما لقيناش هاد الباك." };
  done(b.slug);
  redirect("/admin/bundles");
}

export async function toggleBundle(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const b = await db.bundle.findUnique({ where: { id }, select: { isActive: true, slug: true } });
  if (!b) return;
  await db.bundle.update({ where: { id }, data: { isActive: !b.isActive } });
  done(b.slug);
}
