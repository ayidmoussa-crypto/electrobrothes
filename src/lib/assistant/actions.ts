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
import { sameOperation, stockDelta, updateSignature, type AssistantCard, type OperationKey } from "./rules";

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
  // A decrease of units that never existed (lib/stock CORRECTION): not a loss. Older proposals have none.
  mistake: z.boolean().optional().default(false),
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

const colorName = z.string().trim().min(1).max(40);

/** Edits to an existing product. Every field left null (or an empty list) stays as it is. */
export const updateProposal = z.object({
  product_id: z.string().min(1).max(40),
  name_ar: z.string().trim().min(2).max(160).nullable(),
  name_en: z.string().trim().min(2).max(160).nullable(),
  description_ar: z.string().trim().min(10).max(5000).nullable(),
  description_en: z.string().trim().min(10).max(5000).nullable(),
  unit_cost_mad: money.nullable(),
  prices: z
    .array(z.object({ variant_id: z.string().min(1).max(40).nullable(), price_mad: money.refine((n) => n > 0, "price must be above 0"), compare_at_mad: money.nullable() }))
    .max(20),
  new_colors: z
    .array(
      z.object({
        color_ar: colorName,
        color_en: colorName,
        color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
        quantity: z.number().int().min(0).max(100_000),
        price_mad: money.nullable(),
      }),
    )
    .max(10),
  existing_color: z.object({ color_ar: colorName, color_en: colorName }).nullable(),
});

type StockPayload = z.infer<typeof stockProposal> & { card: Card };
type UpdatePayload = z.infer<typeof updateProposal> & { card: Card; signature: string };
type UpdateUndo = {
  productId: string;
  slug: string;
  updatedAt: string;
  before: { nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; costPrice: number | null };
  prices: { id: string; price: number; compareAtPrice: number | null }[];
  renamed: { id: string; colorAr: string | null; colorEn: string | null } | null;
  newVariantIds: string[];
};
type DraftPayload = z.infer<typeof draftProposal> & { card: Card };
type Card = Pick<AssistantCard, "title" | "image" | "rows" | "warning">;
type StockUndo = { variantId: string; delta: number; unitCost: number | null; slug: string; reason?: "STOCK_IN" | "ADJUSTMENT" | "CORRECTION" };
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
      ...(delta < 0 ? [{ label: "السبب", value: input.mistake ? "غلطة فالإدخال: ماشي خسارة" : "تخسرات ولا خرجات: خسارة كتنقص من الربح" }] : []),
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

const short = (s: string) => (s.length > 90 ? `${s.slice(0, 90)}…` : s);

/** Validates edits to an existing product and files them for confirmation. Changes nothing yet. */
export async function proposeProductUpdate(input: z.infer<typeof updateProposal>, ctx: { actor: string; model: string }) {
  const p = await db.product.findUnique({
    where: { id: input.product_id },
    select: {
      nameAr: true,
      nameEn: true,
      descriptionAr: true,
      descriptionEn: true,
      warrantyMonths: true,
      costPrice: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      variants: { orderBy: { sortOrder: "asc" }, select: { id: true, colorAr: true, colorEn: true, storage: true, price: true, compareAtPrice: true } },
    },
  });
  if (!p) throw new AssistantActionError("product_id not found: search again");

  const changes =
    [input.name_ar, input.name_en, input.description_ar, input.description_en, input.unit_cost_mad, input.existing_color].some((v) => v !== null) ||
    input.prices.length > 0 ||
    input.new_colors.length > 0;
  if (!changes) throw new AssistantActionError("nothing to change: give at least one field");

  // Prices: each colour named must belong to this product; null means every colour.
  const ids = new Set(p.variants.map((v) => v.id));
  for (const pr of input.prices) {
    if (pr.variant_id && !ids.has(pr.variant_id)) throw new AssistantActionError("a variant_id in prices is not a colour of this product: search again");
    if (pr.compare_at_mad !== null && pr.compare_at_mad <= pr.price_mad) throw new AssistantActionError("compare_at_mad must be above price_mad (it is the old price shown struck through)");
  }

  // New colours: different from each other and from the colours already there.
  const taken = new Set(p.variants.flatMap((v) => [v.colorAr, v.colorEn]).filter(Boolean).map((s) => s!.trim().toLowerCase()));
  if (input.existing_color) [input.existing_color.color_ar, input.existing_color.color_en].forEach((s) => taken.add(s.toLowerCase()));
  for (const c of input.new_colors) {
    for (const n of [c.color_ar, c.color_en]) {
      if (taken.has(n.toLowerCase())) throw new AssistantActionError(`the colour "${n}" already exists on this product: use propose_stock_change for its stock`);
    }
    taken.add(c.color_ar.toLowerCase());
    taken.add(c.color_en.toLowerCase());
  }
  // A product sold without colour has one unnamed option: it needs a name before a second colour can sit beside it.
  const colourless = p.variants.length === 1 && !p.variants[0].colorAr && !p.variants[0].storage;
  if (input.new_colors.length && colourless && !input.existing_color) {
    throw new AssistantActionError("this product has one option without colour: ask the admin which colour the current stock is, then pass it as existing_color");
  }
  if (input.existing_color && !colourless) throw new AssistantActionError("existing_color is only for a product whose single option has no colour yet");

  // Rewritten texts may promise nothing the shop has not stated.
  const text = [input.description_ar, input.description_en].filter(Boolean).join(" ");
  if (text) {
    const why = unbackedClaim(text, {
      warrantyMonths: p.warrantyMonths || null,
      deliveryTime: [],
      replacementPolicy: [],
      shopNumbers: [],
      productText: [input.name_ar ?? p.nameAr, input.name_en ?? p.nameEn, p.descriptionAr, p.descriptionEn].join(" "),
    });
    if (why) throw new AssistantActionError(`Rewrite the description without warranty, delivery, return, price or numbers that are not in the product. Problem: ${why}`);
  }

  const label = (v: (typeof p.variants)[number]) => colorLabel(v) || "بدون لون";
  const rows: Card["rows"] = [{ label: "المنتج", value: p.nameAr }];
  if (input.name_ar) rows.push({ label: "الاسم بالعربية", value: input.name_ar });
  if (input.name_en) rows.push({ label: "الاسم بالإنجليزية", value: input.name_en });
  if (input.description_ar) rows.push({ label: "الوصف بالعربية", value: short(input.description_ar) });
  if (input.description_en) rows.push({ label: "الوصف بالإنجليزية", value: short(input.description_en) });
  for (const pr of input.prices) {
    const targets = pr.variant_id ? p.variants.filter((v) => v.id === pr.variant_id) : p.variants;
    const from = [...new Set(targets.map((v) => v.price))].map((n) => formatMAD(n, "ar")).join(" / ");
    rows.push({
      label: pr.variant_id ? `الثمن · ${label(targets[0])}` : "الثمن (كل الألوان)",
      value: `من ${from} إلى ${formatMAD(pr.price_mad, "ar")}${pr.compare_at_mad !== null ? ` (قبل التخفيض ${formatMAD(pr.compare_at_mad, "ar")})` : ""}`,
    });
  }
  if (input.unit_cost_mad !== null) {
    rows.push({ label: "سعر الشراء", value: `${p.costPrice !== null ? `من ${formatMAD(p.costPrice, "ar")} ` : ""}إلى ${formatMAD(input.unit_cost_mad, "ar")} (الطلبات الجديدة فقط)` });
  }
  if (input.existing_color) rows.push({ label: "اللون الحالي", value: input.existing_color.color_ar });
  for (const c of input.new_colors) {
    rows.push({ label: "لون جديد", value: `${c.color_ar} · ${c.quantity} قطعة${c.price_mad !== null ? ` · ${formatMAD(c.price_mad, "ar")}` : ""}` });
  }

  const signature = updateSignature(input);
  const card: Card = {
    title: "تعديل منتج",
    image: p.images[0]?.url ?? null,
    rows,
    warning: await duplicateWarning({ kind: "PRODUCT_UPDATE", product_id: input.product_id, signature }),
  };

  await expireStale();
  const row = await db.assistantAction.create({
    data: {
      kind: "PRODUCT_UPDATE",
      summary: `تعديل · ${p.nameAr}`,
      payload: { ...input, signature, card } as unknown as Prisma.InputJsonValue,
      model: ctx.model,
      requestedBy: ctx.actor,
    },
  });
  return toCard(row);
}

async function applyUpdate(id: string, admin: string, p: UpdatePayload, gone: string) {
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return db.$transaction(async (tx) => {
    await claim(tx, id, "PENDING", { status: "APPLIED", decidedBy: admin, decidedAt: new Date() }, gone);
    const product = await tx.product.findUnique({
      where: { id: p.product_id },
      select: {
        slug: true,
        nameAr: true,
        nameEn: true,
        descriptionAr: true,
        descriptionEn: true,
        costPrice: true,
        variants: { orderBy: { sortOrder: "asc" }, select: { id: true, sku: true, colorAr: true, colorEn: true, price: true, compareAtPrice: true, sortOrder: true } },
      },
    });
    if (!product) throw new AssistantActionError("هاد المنتج تمسح.");

    const undo: UpdateUndo = {
      productId: p.product_id,
      slug: product.slug,
      updatedAt: "",
      before: { nameAr: product.nameAr, nameEn: product.nameEn, descriptionAr: product.descriptionAr, descriptionEn: product.descriptionEn, costPrice: product.costPrice },
      prices: product.variants.map((v) => ({ id: v.id, price: v.price, compareAtPrice: v.compareAtPrice })),
      renamed: null,
      newVariantIds: [],
    };

    for (const pr of p.prices) {
      const targets = pr.variant_id ? product.variants.filter((v) => v.id === pr.variant_id) : product.variants;
      if (!targets.length) throw new AssistantActionError("هاد اللون تمسح من المنتج.");
      await tx.variant.updateMany({ where: { id: { in: targets.map((v) => v.id) } }, data: { price: pr.price_mad, compareAtPrice: pr.compare_at_mad } });
    }

    if (p.existing_color) {
      const only = product.variants[0];
      if (product.variants.length !== 1 || only.colorAr) throw new AssistantActionError("هاد المنتج تبدلو الألوان من بعد الاقتراح. عاود طلب.");
      undo.renamed = { id: only.id, colorAr: only.colorAr, colorEn: only.colorEn };
      await tx.variant.update({ where: { id: only.id }, data: { colorAr: p.existing_color.color_ar, colorEn: p.existing_color.color_en } });
    }

    const base = product.variants[0];
    let order = Math.max(...product.variants.map((v) => v.sortOrder)) + 1;
    for (const [i, c] of p.new_colors.entries()) {
      const variant = await tx.variant.create({
        data: {
          productId: p.product_id,
          sku: `${base.sku}-${slugify(c.color_en).toUpperCase().slice(0, 12) || "C"}-${suffix}${i}`.slice(0, 60),
          colorAr: c.color_ar,
          colorEn: c.color_en,
          colorHex: c.color_hex,
          price: c.price_mad ?? base.price,
          sortOrder: order++,
        },
      });
      undo.newVariantIds.push(variant.id);
      if (c.quantity) await moveStock(tx, { variantId: variant.id, delta: c.quantity, reason: "STOCK_IN", actor: admin, note: NOTE, unitCost: p.unit_cost_mad ?? product.costPrice });
    }

    // Always touched, so a later edit in the product editor is noticed before an undo.
    const updated = await tx.product.update({
      where: { id: p.product_id },
      data: {
        ...(p.name_ar ? { nameAr: p.name_ar } : {}),
        ...(p.name_en ? { nameEn: p.name_en } : {}),
        ...(p.description_ar ? { descriptionAr: p.description_ar } : {}),
        ...(p.description_en ? { descriptionEn: p.description_en } : {}),
        // Orders keep the cost they were placed with: only new orders take this one.
        ...(p.unit_cost_mad !== null ? { costPrice: p.unit_cost_mad } : {}),
        updatedAt: new Date(),
      },
      select: { updatedAt: true },
    });
    undo.updatedAt = updated.updatedAt.toISOString();
    await tx.assistantAction.update({ where: { id }, data: { undo } });
    return [product.slug];
  });
}

async function undoUpdate(id: string, admin: string, u: UpdateUndo, data: Prisma.AssistantActionUpdateManyMutationInput, gone: string) {
  return db
    .$transaction(async (tx) => {
      await claim(tx, id, "APPLIED", data, gone);
      const product = await tx.product.findUnique({
        where: { id: u.productId },
        select: { updatedAt: true, variants: { where: { id: { in: u.newVariantIds } }, select: { id: true, stock: true, _count: { select: { orderItems: true } } } } },
      });
      if (!product) throw new AssistantActionError("هاد المنتج تمسح من قبل.");
      if (product.updatedAt.toISOString() !== u.updatedAt || product.variants.some((v) => v._count.orderItems)) {
        throw new AssistantActionError("هاد المنتج تبدل ولا تباع منو لون جديد من بعد، فما غاديش نرجعو باش ما تضيعش تعديلاتك. بدلو من صفحة المنتج.");
      }
      // New colours go away with their stock, written to the ledger like a deleted colour.
      for (const v of product.variants) {
        if (v.stock > 0) await moveStock(tx, { variantId: v.id, delta: -v.stock, reason: "CORRECTION", actor: admin, note: "تراجع عن عملية المساعد" });
      }
      await tx.variant.deleteMany({ where: { id: { in: u.newVariantIds } } });
      for (const pr of u.prices) await tx.variant.updateMany({ where: { id: pr.id }, data: { price: pr.price, compareAtPrice: pr.compareAtPrice } });
      if (u.renamed) await tx.variant.updateMany({ where: { id: u.renamed.id }, data: { colorAr: u.renamed.colorAr, colorEn: u.renamed.colorEn } });
      await tx.product.update({ where: { id: u.productId }, data: u.before });
      return [u.slug];
    })
    .catch((e) => insufficient(e, "ما يمكنش: جزء من مخزون اللون الجديد تباع من بعد."));
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
        const reason = p.mode === "add" ? "STOCK_IN" : delta < 0 && p.mistake ? "CORRECTION" : "ADJUSTMENT";
        await moveStock(tx, { variantId: p.variant_id, delta, reason, actor: admin, note: NOTE, unitCost: p.unit_cost_mad });
        const { product } = await tx.variant.findUniqueOrThrow({ where: { id: p.variant_id }, select: { product: { select: { slug: true } } } });
        const undo: StockUndo = { variantId: p.variant_id, delta, unitCost: p.unit_cost_mad, slug: product.slug, reason };
        await tx.assistantAction.update({ where: { id }, data: { undo } });
        return [product.slug];
      })
      .catch((e) => insufficient(e, "المخزون الحالي قل من الكمية اللي بغيتي تنقص. عاود شوف الكمية."));
  }

  if (row.kind === "PRODUCT_UPDATE") return applyUpdate(id, admin, row.payload as unknown as UpdatePayload, gone);

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
        // Undoing a stock entry or a correction cancels a record, it is no loss; undoing a loss is an adjustment back.
        const reason = u.reason === "STOCK_IN" || u.reason === "CORRECTION" || (!u.reason && u.delta > 0) ? "CORRECTION" : "ADJUSTMENT";
        await moveStock(tx, { variantId: u.variantId, delta: -u.delta, reason, actor: admin, note: "تراجع عن عملية المساعد", unitCost: u.unitCost });
        return [u.slug];
      })
      .catch((e) => insufficient(e, "ما يمكنش: جزء من هاد الكمية تباع من بعد، والمخزون الحالي قليل."));
  }

  if (row.kind === "PRODUCT_UPDATE") return undoUpdate(id, admin, row.undo as unknown as UpdateUndo, data, gone);

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
      await moveStock(tx, { variantId: v.id, delta: -v.stock, reason: "CORRECTION", actor: admin, note: "تراجع عن عملية المساعد" });
    }
    await tx.product.delete({ where: { id: u.productId } });
    if (u.newBrandId) await tx.brand.deleteMany({ where: { id: u.newBrandId, products: { none: {} } } });
    return [u.slug];
  });
}
