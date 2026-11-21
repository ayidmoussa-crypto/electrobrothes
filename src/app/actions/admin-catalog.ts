"use server";

import { revalidatePath, updateTag } from "next/cache";
import { ADMIN_STATS_TAG } from "@/lib/admin-stats-tag";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { bannerImageList } from "@/lib/category-banner";
import { db } from "@/lib/db";
import { whatsappDigits } from "@/lib/phone";
import { slugify } from "@/lib/product-input";
import { moroccanDate } from "@/lib/time";

type State = { ok?: boolean; message?: string };

const fields = (fd: FormData) => Object.fromEntries([...fd].filter(([, v]) => typeof v === "string"));
const bool = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const optionalInt = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(10_000_000).nullable());
const optionalDate = z.preprocess((v) => (v ? moroccanDate(String(v)) : null), z.date().nullable());
const id = z.string().max(40).optional().transform((v) => v || undefined);

async function run(task: () => Promise<unknown>, paths: string[], tags: string[], success: string): Promise<State> {
  await requireAdmin();
  try {
    await task();
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: (await adminTr()).tr("تحقق من الحقول المطلوبة.", "Check the required fields.") };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: (await adminTr()).tr("هذه القيمة مستعملة من قبل (يجب أن تكون فريدة).", "This value is already used (it must be unique).") };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") return { ok: false, message: (await adminTr()).tr("لا يمكن الحذف: هناك عناصر مرتبطة به.", "Cannot delete: other items are linked to it.") };
    throw e;
  }
  for (const p of paths) revalidatePath(p);
  // updateTag: the next storefront visit already shows the change.
  for (const t of tags) updateTag(t);
  return { ok: true, message: success };
}

// ───────── Categories ─────────
const categoryInput = z.object({
  id,
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  image: z.string().trim().max(500).optional(),
  bannerImages: z.string().max(3000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function saveCategory(_: State, fd: FormData) {
  return run(
    async () => {
      const c = categoryInput.parse(fields(fd));
      const data = { nameAr: c.nameAr, nameEn: c.nameEn, slug: slugify(c.slug || c.nameEn), image: c.image || null, bannerImages: bannerImageList(c.bannerImages ?? ""), sortOrder: c.sortOrder };
      if (!data.slug) throw new z.ZodError([]);
      if (c.id) await db.category.update({ where: { id: c.id }, data });
      else await db.category.create({ data });
    },
    ["/admin/categories"],
    ["categories", "products"],
    (await adminTr()).tr("تم الحفظ.", "Saved."),
  );
}

export async function deleteCategory(_: State, fd: FormData) {
  return run(() => db.category.delete({ where: { id: String(fd.get("id")) } }), ["/admin/categories"], ["categories"], (await adminTr()).tr("تم الحذف.", "Deleted."));
}

// ───────── Brands ─────────
const brandInput = z.object({ id, name: z.string().trim().min(1).max(60), slug: z.string().trim().max(60).optional() });

export async function saveBrand(_: State, fd: FormData) {
  return run(
    async () => {
      const b = brandInput.parse(fields(fd));
      const data = { name: b.name, slug: slugify(b.slug || b.name) };
      if (b.id) await db.brand.update({ where: { id: b.id }, data });
      else await db.brand.create({ data });
    },
    ["/admin/brands"],
    ["products"],
    (await adminTr()).tr("تم الحفظ.", "Saved."),
  );
}

export async function deleteBrand(_: State, fd: FormData) {
  return run(() => db.brand.delete({ where: { id: String(fd.get("id")) } }), ["/admin/brands"], ["products"], (await adminTr()).tr("تم الحذف.", "Deleted."));
}

// ───────── Cities & delivery fees ─────────
const cityInput = z.object({
  id,
  nameAr: z.string().trim().min(2).max(60),
  nameEn: z.string().trim().min(2).max(60),
  shippingFee: z.coerce.number().int().min(0).max(10_000),
  deliveryDays: z.string().trim().min(1).max(10),
  isActive: bool,
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function saveCity(_: State, fd: FormData) {
  return run(
    async () => {
      const { id: cityId, ...data } = cityInput.parse(fields(fd));
      if (cityId) await db.city.update({ where: { id: cityId }, data });
      else await db.city.create({ data });
    },
    ["/admin/cities"],
    // A city's delivery fee is part of the profit figures.
    ["settings", ADMIN_STATS_TAG],
    (await adminTr()).tr("تم الحفظ.", "Saved."),
  );
}

// ───────── Coupons ─────────
const couponInput = z.object({
  id,
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/).transform((s) => s.toUpperCase()),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().int().min(1).max(100_000),
  minSubtotal: optionalInt,
  maxUses: optionalInt,
  startsAt: optionalDate,
  expiresAt: optionalDate,
  isActive: bool,
});

export async function saveCoupon(_: State, fd: FormData) {
  return run(
    async () => {
      const { id: couponId, ...data } = couponInput.parse(fields(fd));
      if (data.type === "PERCENT" && data.value > 90) throw new z.ZodError([]);
      if (couponId) await db.coupon.update({ where: { id: couponId }, data });
      else await db.coupon.create({ data });
    },
    ["/admin/coupons"],
    [],
    (await adminTr()).tr("تم الحفظ.", "Saved."),
  );
}

export async function deleteCoupon(_: State, fd: FormData) {
  return run(() => db.coupon.delete({ where: { id: String(fd.get("id")) } }), ["/admin/coupons"], [], (await adminTr()).tr("تم الحذف.", "Deleted."));
}

// ───────── Settings ─────────
const settingsInput = z.object({
  freeShippingThreshold: z.coerce.number().int().min(0).max(1_000_000),
  // Typed any way (0612345678, +212 6 12...), stored the way wa.me links expect. Empty hides the button.
  whatsappNumber: z.string().trim().refine((v) => v === "" || whatsappDigits(v) !== null).transform((v) => (v ? whatsappDigits(v)! : "")),
  notifyEmail: z.union([z.literal(""), z.string().trim().email().max(120)]),
  // Entered in dollars, stored in cents.
  assistantBudgetCents: z.coerce.number().min(0).max(1000).transform((d) => Math.round(d * 100)),
  supportBudgetCents: z.coerce.number().min(0).max(1000).transform((d) => Math.round(d * 100)),
  supportRewardPercent: z.coerce.number().int().min(0).max(50),
  supportRewardDays: z.coerce.number().int().min(1).max(365),
  seoAutoApply: bool,
  deliveryTimeAr: z.string().trim().min(1).max(60),
  deliveryTimeEn: z.string().trim().min(1).max(60),
  replacementPolicyAr: z.string().trim().min(1).max(500),
  replacementPolicyEn: z.string().trim().min(1).max(500),
  landingEditorialFrom: z.coerce.number().int().min(0).max(1_000_000),
});

export async function saveSettings(_: State, fd: FormData) {
  return run(
    async () => {
      const data = settingsInput.parse(fields(fd));
      await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    },
    ["/admin/settings"],
    ["settings"],
    (await adminTr()).tr("تم حفظ الإعدادات.", "Settings saved."),
  );
}
