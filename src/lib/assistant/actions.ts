import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { cloudinaryConfigured, uploadImage } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { slugify } from "@/lib/product-input";
import { colorLabel, InsufficientStockError, moveStock } from "@/lib/stock";
import { unbackedClaim } from "@/lib/seo-content/rules";
import { sameOperation, stockDelta, type AssistantCard, type OperationKey } from "./rules";

// The only code that lets the assistant change data. Claude can only create PENDING rows here; the
// catalog changes in applyAction, which only an admin's "تأكيد" reaches (see app/actions/admin-assistant.ts).

const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
const NOTE = "عبر المساعد الذكي";
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const DUPLICATE_WARNING = "هادي بحال اللي سجلتي دابا";

/** A refusal worded for the admin; the transaction rolls back and the row keeps its status. */
export class AssistantActionError extends Error {}

const money = z.number().int().min(0).max(1_000_000);

export const stockProposal = z.object({
  variant_id: z.string().min(1).max(40),
  mode: z.enum(["add", "remove", "set"]),
  quantity: z.number().int().min(0).max(100_000),
  unit_cost_mad: money.nullable(),
});

export const draftProposal = z.object({
  name_ar: z.string().trim().min(2).max(160),
  name_en: z.string().trim().min(2).max(160),
  description_ar: z.string().trim().min(10).max(5000),
  description_en: z.string().trim().min(10).max(5000),
  category_id: z.string().min(1).max(40),
  brand_id: z.string().min(1).max(40).nullable(),
  new_brand_name: z.string().trim().min(1).max(60).nullable(),
  price_mad: money.nullable(),
  unit_cost_mad: money.nullable(),
  use_attached_photo: z.boolean(),
  colors: z
    .array(z.object({ color_ar: z.string().trim().min(1).max(40).nullable(), color_en: z.string().trim().min(1).max(40).nullable(), quantity: z.number().int().min(0).max(100_000) }))
    .min(1)
    .max(10),
});

type StockPayload = z.infer<typeof stockProposal> & { card: Card };
type DraftPayload = z.infer<typeof draftProposal> & { card: Card };
type Card = Pick<AssistantCard, "title" | "image" | "rows" | "warning">;
type StockUndo = { variantId: string; delta: number; unitCost: number | null; slug: string };
type DraftUndo = { productId: string; slug: string; updatedAt: string; newBrandId: string | null };

const toCard = (row: { id: string; kind: AssistantCard["kind"]; status: AssistantCard["status"]; summary: string; payload: unknown }): AssistantCard => ({
  id: row.id,
  kind: row.kind,
  status: row.status,
  summary: row.summary,
  ...(row.payload as { card: Card }).card,
});

export const actionCard = toCard;

async function expireStale() {
  await db.assistantAction.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - PROPOSAL_TTL_MS) } },
    data: { status: "EXPIRED", photo: null },
  });
}

/** The warning for a card repeating an operation confirmed in the last 10 minutes (undone ones don't count). */
async function duplicateWarning(op: OperationKey) {
  const recent = await db.assistantAction.findMany({
    where: { kind: op.kind, status: "APPLIED", decidedAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
    select: { payload: true },
  });
  return recent.some((r) => sameOperation(op, { ...(r.payload as object), kind: op.kind } as OperationKey)) ? DUPLICATE_WARNING : undefined;
}

/** Validates a stock request against the catalog and files it for confirmation. Changes no stock. */
export async function proposeStockChange(input: z.infer<typeof stockProposal>, ctx: { actor: string; model: string }) {
  const v = await db.variant.findUnique({
    where: { id: input.variant_id },
    select: { sku: true, colorAr: true, storage: true, stock: true, product: { select: { nameAr: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } },
  });
  if (!v) throw new AssistantActionError("variant_id not found: search again");
  const delta = stockDelta(input.mode, input.quantity, v.stock);
  if (input.mode !== "set" && input.quantity === 0) throw new AssistantActionError("quantity must be above 0");
  if (delta === 0) throw new AssistantActionError(`nothing to change: stock is already ${v.stock}`);
  if (v.stock + delta < 0) throw new AssistantActionError(`cannot remove ${-delta}: only ${v.stock} in stock`);

  const color = colorLabel(v);
  const summary = `${delta > 0 ? `+${delta}` : delta} · ${v.product.nameAr}${color ? ` · ${color}` : ""}`;
  const card: Card = {
    title: delta > 0 ? "زيادة فالمخزون" : "نقص فالمخزون",
    image: v.product.images[0]?.url ?? null,
    rows: [
      { label: "المنتج", value: v.product.nameAr },
      ...(color ? [{ label: "اللون", value: color }] : []),
      { label: "المخزون", value: `من ${v.stock} إلى ${v.stock + delta}` },
      ...(input.unit_cost_mad !== null ? [{ label: "سعر الشراء", value: formatMAD(input.unit_cost_mad, "ar") }] : []),
    ],
    warning: await duplicateWarning({ kind: "STOCK_CHANGE", variant_id: input.variant_id, mode: input.mode, quantity: input.quantity }),
  };

  await expireStale();
  const row = await db.assistantAction.create({
    data: { kind: "STOCK_CHANGE", summary, payload: { ...input, card } as unknown as Prisma.InputJsonValue, model: ctx.model, requestedBy: ctx.actor },
  });
  return toCard(row);
}

/** Validates a new-product request and files it for confirmation. Creates nothing yet. */
export async function proposeDraft(input: z.infer<typeof draftProposal>, ctx: { actor: string; model: string; photo: string | null }) {
  const [category, brand] = await Promise.all([
    db.category.findUnique({ where: { id: input.category_id }, select: { nameAr: true } }),
    input.brand_id ? db.brand.findUnique({ where: { id: input.brand_id }, select: { name: true } }) : null,
  ]);
  if (!category) throw new AssistantActionError("category_id not found: call list_taxonomy");
  if (input.brand_id && !brand) throw new AssistantActionError("brand_id not found: call list_taxonomy");
  if (!input.brand_id && !input.new_brand_name) throw new AssistantActionError("give brand_id or new_brand_name");
  // A new draft has no warranty, no specifications and no stated numbers yet: its text may promise nothing.
  const why = unbackedClaim(`${input.description_ar} ${input.description_en}`, {
    warrantyMonths: null,
    deliveryTime: [],
    replacementPolicy: [],
    shopNumbers: [],
    productText: `${input.name_ar} ${input.name_en}`,
  });
  if (why) throw new AssistantActionError(`Rewrite the description without warranty, delivery, return, price or any number that is not in the product name. Problem: ${why}`);
  const names = input.colors.map((c) => c.color_ar ?? "");
  if (input.colors.length > 1 && (names.some((n) => !n) || new Set(names).size !== names.length)) {
    throw new AssistantActionError("several colours must each have a different color_ar");
  }

  const photo = input.use_attached_photo ? ctx.photo : null;
  const uploadable = !!photo && cloudinaryConfigured();
  const stock = input.colors.map((c) => `${c.color_ar ?? "بدون لون"}: ${c.quantity}`).join("، ");
  const card: Card = {
    title: "منتج جديد (مسودة مخفية)",
    image: null,
    rows: [
      { label: "الاسم", value: input.name_ar },
      { label: "القسم", value: category.nameAr },
      { label: "الماركة", value: brand?.name ?? `${input.new_brand_name} (جديدة)` },
      { label: "المخزون", value: stock },
      { label: "سعر البيع", value: input.price_mad !== null ? formatMAD(input.price_mad, "ar") : "خاصك تحددو قبل النشر" },
      ...(input.unit_cost_mad !== null ? [{ label: "سعر الشراء", value: formatMAD(input.unit_cost_mad, "ar") }] : []),
      { label: "الصورة", value: uploadable ? "الصورة اللي صيفطتي" : "بلا صورة: زيدها من صفحة المنتج" },
    ],
    warning: await duplicateWarning({ kind: "DRAFT_PRODUCT", name_en: input.name_en, colors: input.colors }),
  };

  await expireStale();
  const row = await db.assistantAction.create({
    data: {
      kind: "DRAFT_PRODUCT",
      summary: `مسودة جديدة · ${input.name_ar}`,
      payload: { ...input, card } as unknown as Prisma.InputJsonValue,
      photo: uploadable ? photo : null,
      model: ctx.model,
      requestedBy: ctx.actor,
    },
  });
  return toCard(row);
}

// ───────── Confirm / cancel / undo (admin only: callers run requireAdmin) ─────────

/** Claims a row inside the transaction, so a double click or a second tab applies it only once. */
async function claim(tx: Prisma.TransactionClient, id: string, from: "PENDING" | "APPLIED", data: Prisma.AssistantActionUpdateManyMutationInput, notFound: string) {
  const where: Prisma.AssistantActionWhereInput = { id, status: from, ...(from === "PENDING" ? { createdAt: { gte: new Date(Date.now() - PROPOSAL_TTL_MS) } } : {}) };
  const { count } = await tx.assistantAction.updateMany({ where, data });
  if (!count) throw new AssistantActionError(notFound);
}

const insufficient = (e: unknown, message: string) => {
  if (e instanceof InsufficientStockError) throw new AssistantActionError(message);
  throw e;
};

/** Applies a confirmed proposal; returns the storefront slugs to refresh. */
export async function applyAction(id: string, admin: string) {
  const row = await db.assistantAction.findUnique({ where: { id }, select: { kind: true, payload: true, photo: true } });
  if (!row) throw new AssistantActionError("هاد الاقتراح ما كاينش.");
  const gone = "هاد الاقتراح تنفذ ولا تلغى ولا سالا وقتو.";

  if (row.kind === "STOCK_CHANGE") {
    const p = row.payload as unknown as StockPayload;
    return db
      .$transaction(async (tx) => {
        await claim(tx, id, "PENDING", { status: "APPLIED", decidedBy: admin, decidedAt: new Date() }, gone);
        // Lock the row: "sold out" must zero what is there now, not what the card showed.
        const [current] = await tx.$queryRaw<{ stock: number }[]>`SELECT "stock" FROM "Variant" WHERE "id" = ${p.variant_id} FOR UPDATE`;
        if (!current) throw new AssistantActionError("هاد اللون تمسح من المنتج.");
        const delta = stockDelta(p.mode, p.quantity, current.stock);
        if (!delta) throw new AssistantActionError(`المخزون ديجا ${current.stock}، ما كاين ما يتبدل.`);
        await moveStock(tx, { variantId: p.variant_id, delta, reason: p.mode === "add" ? "STOCK_IN" : "ADJUSTMENT", actor: admin, note: NOTE, unitCost: p.unit_cost_mad });
        const { product } = await tx.variant.findUniqueOrThrow({ where: { id: p.variant_id }, select: { product: { select: { slug: true } } } });
        const undo: StockUndo = { variantId: p.variant_id, delta, unitCost: p.unit_cost_mad, slug: product.slug };
        await tx.assistantAction.update({ where: { id }, data: { undo } });
        return [product.slug];
      })
      .catch((e) => insufficient(e, "المخزون الحالي قل من الكمية اللي بغيتي تنقص. عاود شوف الكمية."));
  }

  const p = row.payload as unknown as DraftPayload;
  // Outside the transaction: never hold a database connection during an upload.
  const imageUrl = row.photo ? await uploadImage(row.photo, "electrobrothers/products") : null;
  const suffix = randomBytes(3).toString("hex");
  const slugs = await db.$transaction(async (tx) => {
    await claim(tx, id, "PENDING", { status: "APPLIED", decidedBy: admin, decidedAt: new Date(), photo: null }, gone);
    const brandSlug = p.new_brand_name ? `${slugify(p.new_brand_name) || "brand"}-${suffix}` : null;
    const newBrand = p.brand_id ? null : await tx.brand.create({ data: { name: p.new_brand_name!, slug: brandSlug! } });
    const slug = `${slugify(p.name_en) || "draft"}-${suffix}`;
    const product = await tx.product.create({
      data: {
        slug,
        nameAr: p.name_ar,
        nameEn: p.name_en,
        descriptionAr: p.description_ar,
        descriptionEn: p.description_en,
        categoryId: p.category_id,
        brandId: p.brand_id ?? newBrand!.id,
        // Unknown until the owner fills it in: the schema's default would invent one.
        warrantyMonths: 0,
        isActive: false,
        costPrice: p.unit_cost_mad,
        images: imageUrl ? { create: { url: imageUrl, altAr: p.name_ar, altEn: p.name_en } } : undefined,
      },
    });
    for (const [i, c] of p.colors.entries()) {
      const variant = await tx.variant.create({
        data: {
          productId: product.id,
          sku: `DRAFT-${suffix}-${i + 1}`.toUpperCase(),
          colorAr: c.color_ar,
          colorEn: c.color_en ?? c.color_ar,
          // 0 keeps it unpublishable: the product editor requires a real price before it is shown.
          price: p.price_mad ?? 0,
          isDefault: i === 0,
          sortOrder: i,
        },
      });
      if (c.quantity) await moveStock(tx, { variantId: variant.id, delta: c.quantity, reason: "STOCK_IN", actor: admin, note: NOTE, unitCost: p.unit_cost_mad });
    }
    const undo: DraftUndo = { productId: product.id, slug, updatedAt: product.updatedAt.toISOString(), newBrandId: newBrand?.id ?? null };
    await tx.assistantAction.update({ where: { id }, data: { undo } });
    return [slug];
  });
  // Unscored products are picked up by ensureScored: a draft is scored the first time the SEO page opens.
  return slugs;
}

export async function cancelAction(id: string, admin: string) {
  const { count } = await db.assistantAction.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELLED", decidedBy: admin, decidedAt: new Date(), photo: null } });
  if (!count) throw new AssistantActionError("هاد الاقتراح تنفذ ولا تلغى من قبل.");
}

/** Reverses an applied action; returns the storefront slugs to refresh. */
export async function undoAction(id: string, admin: string) {
  const row = await db.assistantAction.findUnique({ where: { id }, select: { kind: true, undo: true } });
  if (!row?.undo) throw new AssistantActionError("هادي ما يمكنش التراجع عليها.");
  const data = { status: "UNDONE", undoneBy: admin, undoneAt: new Date() } as const;
  const gone = "تراجعتي على هادي من قبل.";

  if (row.kind === "STOCK_CHANGE") {
    const u = row.undo as unknown as StockUndo;
    return db
      .$transaction(async (tx) => {
        await claim(tx, id, "APPLIED", data, gone);
        // Reverses the amount, not the old total: orders confirmed since then stay counted.
        const variant = await tx.variant.findUnique({ where: { id: u.variantId }, select: { id: true } });
        if (!variant) throw new AssistantActionError("هاد اللون تمسح من المنتج.");
        await moveStock(tx, { variantId: u.variantId, delta: -u.delta, reason: "ADJUSTMENT", actor: admin, note: "تراجع عن عملية المساعد", unitCost: u.unitCost });
        return [u.slug];
      })
      .catch((e) => insufficient(e, "ما يمكنش: جزء من هاد الكمية تباع من بعد، والمخزون الحالي قليل."));
  }

  const u = row.undo as unknown as DraftUndo;
  return db.$transaction(async (tx) => {
    await claim(tx, id, "APPLIED", data, gone);
    const product = await tx.product.findUnique({
      where: { id: u.productId },
      select: { isActive: true, updatedAt: true, variants: { select: { id: true, stock: true, _count: { select: { orderItems: true } } } } },
    });
    if (!product) throw new AssistantActionError("هاد المنتج تمسح من قبل.");
    if (product.isActive || product.updatedAt.toISOString() !== u.updatedAt || product.variants.some((v) => v._count.orderItems)) {
      throw new AssistantActionError("هاد المنتج تبدل من بعد ما تصايب، فما غاديش نمسحو باش ما تضيعش تعديلاتك. مسحو من صفحة المنتجات إلا بغيتي.");
    }
    // The ledger keeps its snapshot rows, like deleting a colour in the product editor.
    for (const v of product.variants.filter((v) => v.stock > 0)) {
      await moveStock(tx, { variantId: v.id, delta: -v.stock, reason: "ADJUSTMENT", actor: admin, note: "تراجع عن عملية المساعد" });
    }
    await tx.product.delete({ where: { id: u.productId } });
    if (u.newBrandId) await tx.brand.deleteMany({ where: { id: u.newBrandId, products: { none: {} } } });
    return [u.slug];
  });
}
