import "server-only";
import { randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { channelOfManualSource, type Touch } from "./attribution";
import { TRIGGER_OF_STATUS } from "./automation-rules";
import { fireOrderEvent } from "./automations";
import { manualTotals, type ManualOrderInput } from "./manual-order";
import { bundleDiscount } from "./bundles";
import { bundleRulesFor } from "./bundles-data";
import { assessRisk, newOrderNumber, transitionPlan, type OrderStatus } from "./order-rules";
import { normalizeMoroccanPhone } from "./phone";
import { computeTotals } from "./pricing";
import { effectiveCost, InsufficientStockError, moveStock } from "./stock";

/** httpOnly cookie holding the id of the order this browser just placed (confirmation page). */
export const ORDER_COOKIE = "eb_order";

// ───────────────────────── Input validation (trust boundary) ─────────────────────────

const cartItems = z
  .array(z.object({ variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(10) }))
  .min(1)
  .max(20);

export const orderInput = z.object({
  items: z.string().transform((s, ctx) => {
    try {
      return cartItems.parse(JSON.parse(s));
    } catch {
      ctx.addIssue({ code: "custom", message: "cart" });
      return z.NEVER;
    }
  }),
  name: z.string().trim().min(3, "name").max(80, "name"),
  phone: z.string().transform((s, ctx) => normalizeMoroccanPhone(s) ?? (ctx.addIssue({ code: "custom", message: "phone" }), z.NEVER)),
  cityId: z.string().min(1, "city").max(40, "city"),
  address: z.string().trim().min(8, "address").max(300, "address"),
  notes: z.string().trim().max(500, "notes").optional().transform((s) => s || null),
  coupon: z.string().trim().toUpperCase().max(30).optional().transform((s) => s || null),
  // Bots fill every field; humans never see this one.
  website: z.string().optional(),
  startedAt: z.coerce.number().optional(),
});

export type OrderInput = z.infer<typeof orderInput>;

export type PlaceOrderResult =
  | { ok: true; orderId: string; number: string; duplicate?: boolean }
  | {
      ok: false;
      error: "rate_limited" | "captcha" | "unavailable" | "out_of_stock" | "blocked" | "coupon" | "unknown";
      couponError?: string;
      /** Variants that no longer have enough stock (the form already knows their names). */
      variantIds?: string[];
    };

// ───────────────────────── Place a cash-on-delivery order ─────────────────────────

export async function placeOrder(input: OrderInput, ctx: { ip: string; userAgent: string | null; ordersFromIpLastHour: number; touch?: Touch | null }) {
  const variantIds = input.items.map((i) => i.variantId);
  const [variants, city, settings, coupon, blacklisted, recentSamePhone] = await Promise.all([
    db.variant.findMany({
      where: { id: { in: variantIds }, product: { isActive: true } },
      include: { product: { select: { nameAr: true, nameEn: true, costPrice: true } } },
    }),
    db.city.findFirst({ where: { id: input.cityId, isActive: true } }),
    db.settings.findUnique({ where: { id: 1 } }),
    input.coupon ? db.coupon.findUnique({ where: { code: input.coupon } }) : null,
    db.blacklist.findUnique({ where: { phone: input.phone } }),
    db.order.findMany({
      where: { phone: input.phone, createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) }, status: { in: ["NEW", "CONFIRMED"] } },
      include: { items: { select: { variantId: true, quantity: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!city) return { ok: false, error: "unavailable" } satisfies PlaceOrderResult;
  const byId = new Map(variants.map((v) => [v.id, v]));
  if (variantIds.some((id) => !byId.has(id))) return { ok: false, error: "unavailable" } satisfies PlaceOrderResult;

  const short = input.items.filter((i) => byId.get(i.variantId)!.stock < i.qty);
  if (short.length) {
    return { ok: false, error: "out_of_stock", variantIds: short.map((i) => i.variantId) } satisfies PlaceOrderResult;
  }

  if (input.coupon && !coupon) return { ok: false, error: "coupon", couponError: "not_found" } satisfies PlaceOrderResult;

  const lines = input.items.map((i) => ({ ...i, v: byId.get(i.variantId)! }));
  // Complete packs in the basket come off first; the coupon applies to the rest.
  const bundles = bundleDiscount(
    lines.map((l) => ({ productId: l.v.productId, unitPrice: l.v.price, quantity: l.qty })),
    await bundleRulesFor([...new Set(lines.map((l) => l.v.productId))]),
  );
  const totals = computeTotals({
    items: lines.map((l) => ({ unitPrice: l.v.price, quantity: l.qty })),
    shippingFee: city.shippingFee,
    freeShippingThreshold: settings?.freeShippingThreshold ?? 1000,
    coupon,
    bundleDiscount: bundles.discount,
  });
  if (totals.couponError) return { ok: false, error: "coupon", couponError: totals.couponError } satisfies PlaceOrderResult;

  // Double-submit / impatient re-click: same phone, same basket, minutes ago → return that order.
  const sameBasket = (o: (typeof recentSamePhone)[number]) =>
    o.items.length === lines.length && lines.every((l) => o.items.some((i) => i.variantId === l.variantId && i.quantity === l.qty));
  const duplicate = recentSamePhone.find((o) => o.status === "NEW" && Date.now() - o.createdAt.getTime() < 10 * 60 * 1000 && sameBasket(o));
  if (duplicate) return { ok: true, orderId: duplicate.id, number: duplicate.number, duplicate: true } satisfies PlaceOrderResult;

  const risk = assessRisk({
    blacklisted: !!blacklisted,
    honeypotFilled: !!input.website,
    recentOrdersSamePhone: recentSamePhone.length,
    fillSeconds: input.startedAt ? (Date.now() - input.startedAt) / 1000 : null,
    ordersFromIpLastHour: ctx.ordersFromIpLastHour,
    total: totals.total,
  });
  if (risk.block) return { ok: false, error: "blocked" } satisfies PlaceOrderResult;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await db.$transaction(async (tx) => {
        if (coupon) {
          // Conditional increment: two customers can never both take the last use.
          const used = await tx.coupon.updateMany({
            where: { id: coupon.id, ...(coupon.maxUses !== null ? { usedCount: { lt: coupon.maxUses } } : {}) },
            data: { usedCount: { increment: 1 } },
          });
          if (!used.count) throw new CouponUsedUp();
        }
        return tx.order.create({
          data: {
            number: newOrderNumber(randomBytes),
            customerName: input.name,
            phone: input.phone,
            cityId: city.id,
            cityName: city.nameAr,
            address: input.address,
            notes: input.notes,
            subtotal: totals.subtotal,
            shippingFee: totals.shipping,
            discount: totals.discount,
            bundleDiscount: totals.bundleDiscount,
            total: totals.total,
            couponCode: coupon?.code ?? null,
            riskScore: risk.score,
            riskFlags: risk.flags,
            // No cookie at all (blocked, or a visit the proxy never saw) is the same as a direct visit.
            channel: ctx.touch?.channel ?? "DIRECT",
            channelDetail: ctx.touch?.detail ?? null,
            ip: ctx.ip,
            userAgent: ctx.userAgent?.slice(0, 300) ?? null,
            items: {
              create: lines.map((l) => ({
                variantId: l.v.id,
                sku: l.v.sku,
                nameAr: l.v.product.nameAr,
                nameEn: l.v.product.nameEn,
                variantLabel: [l.v.colorAr, l.v.storage].filter(Boolean).join(" · ") || null,
                unitPrice: l.v.price,
                unitCost: effectiveCost(l.v.costPrice, l.v.product.costPrice),
                quantity: l.qty,
              })),
            },
            logs: { create: { toStatus: "NEW", actor: "customer" } },
          },
          select: { id: true, number: true },
        });
      });
      return { ok: true, orderId: order.id, number: order.number } satisfies PlaceOrderResult;
    } catch (error) {
      if (error instanceof CouponUsedUp) return { ok: false, error: "coupon", couponError: "used_up" } satisfies PlaceOrderResult;
      // Order number collision (1 in ~10⁹): try a new number.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return { ok: false, error: "unknown" } satisfies PlaceOrderResult;
}

class CouponUsedUp extends Error {}

// ───────────────────────── An order typed in by the owner ─────────────────────────

export type ManualOrderResult =
  | { ok: true; orderId: string; number: string; confirmError?: string }
  | { ok: false; error: "blocked" | "unavailable" | "out_of_stock" | "discount"; skus?: string[] };

/** From a WhatsApp, phone or social conversation. No captcha or rate limit; the blacklist and the stock still apply. */
export async function createManualOrder(input: ManualOrderInput, actor: string): Promise<ManualOrderResult> {
  const quantities = new Map<string, number>();
  for (const l of input.items) quantities.set(l.variantId, (quantities.get(l.variantId) ?? 0) + l.qty);
  const ids = [...quantities.keys()];

  const [variants, city, blacklisted, recent] = await Promise.all([
    db.variant.findMany({ where: { id: { in: ids } }, include: { product: { select: { nameAr: true, nameEn: true, costPrice: true } } } }),
    db.city.findFirst({ where: { id: input.cityId, isActive: true } }),
    db.blacklist.findUnique({ where: { phone: input.phone } }),
    db.order.count({ where: { phone: input.phone, createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) }, status: { in: ["NEW", "CONFIRMED"] } } }),
  ]);
  if (blacklisted) return { ok: false, error: "blocked" };
  if (!city || variants.length !== ids.length) return { ok: false, error: "unavailable" };
  const short = variants.filter((v) => v.stock < quantities.get(v.id)!);
  if (short.length) return { ok: false, error: "out_of_stock", skus: short.map((v) => v.sku) };

  const totals = manualTotals(input.items, input.shippingFee, input.discount);
  if (totals.total === null) return { ok: false, error: "discount" };

  const byId = new Map(variants.map((v) => [v.id, v]));
  const risk = assessRisk({ blacklisted: false, honeypotFilled: false, recentOrdersSamePhone: recent, fillSeconds: null, ordersFromIpLastHour: 0, total: totals.total });

  let order: { id: string; number: string } | null = null;
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    try {
      order = await db.order.create({
        data: {
          number: newOrderNumber(randomBytes),
          source: input.source,
          channel: channelOfManualSource(input.source),
          customerName: input.name,
          phone: input.phone,
          cityId: city.id,
          cityName: city.nameAr,
          address: input.address,
          notes: input.notes,
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          discount: totals.discount,
          total: totals.total,
          riskScore: risk.score,
          riskFlags: risk.flags,
          items: {
            create: input.items.map((l) => {
              const v = byId.get(l.variantId)!;
              return {
                variantId: v.id,
                sku: v.sku,
                nameAr: v.product.nameAr,
                nameEn: v.product.nameEn,
                variantLabel: [v.colorAr, v.storage].filter(Boolean).join(" · ") || null,
                unitPrice: l.unitPrice,
                unitCost: effectiveCost(v.costPrice, v.product.costPrice),
                quantity: l.qty,
              };
            }),
          },
          logs: { create: { toStatus: "NEW", actor } },
        },
        select: { id: true, number: true },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  if (!order) return { ok: false, error: "unavailable" };

  if (!input.confirmNow) {
    await fireOrderEvent(order.id, "order_created");
    return { ok: true, orderId: order.id, number: order.number };
  }
  try {
    await changeOrderStatus(order.id, "CONFIRMED", actor);
    return { ok: true, orderId: order.id, number: order.number };
  } catch (e) {
    // Someone else took the last piece in between: the order exists, unconfirmed, and the owner is told.
    if (e instanceof OrderTransitionError) return { ok: true, orderId: order.id, number: order.number, confirmError: e.sku ?? e.reason };
    throw e;
  }
}

// ───────────────────────── Status changes + inventory ─────────────────────────

export class OrderTransitionError extends Error {
  constructor(public reason: "not_found" | "not_allowed" | "insufficient_stock", public sku?: string) {
    super(reason);
  }
}

/**
 * Moves an order to a new status, takes stock on confirmation and gives it back on
 * cancel / return, and logs who did it. Row-locked so two admins cannot double-apply.
 */
export async function changeOrderStatus(orderId: string, to: OrderStatus, actor: string, note?: string) {
  const stockMoved = await db.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<{ status: OrderStatus; stockDeducted: boolean; number: string }[]>`
      SELECT "status", "stockDeducted", "number" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    if (!order) throw new OrderTransitionError("not_found");

    const plan = transitionPlan(order.status, to, order.stockDeducted);
    if (!plan.allowed) throw new OrderTransitionError("not_allowed");

    if (plan.stock) {
      // Each line moves the stock of the exact colour ordered, and is written to the stock ledger.
      const reason = plan.stock === "take" ? "ORDER_CONFIRMED" : to === "RETURNED" ? "ORDER_RETURNED" : "ORDER_CANCELLED";
      const items = await tx.orderItem.findMany({ where: { orderId, variantId: { not: null } } });
      for (const item of items) {
        try {
          await moveStock(tx, {
            variantId: item.variantId!,
            delta: plan.stock === "take" ? -item.quantity : item.quantity,
            reason,
            actor,
            order: { id: orderId, number: order.number },
          });
        } catch (e) {
          if (e instanceof InsufficientStockError) throw new OrderTransitionError("insufficient_stock", item.sku);
          throw e;
        }
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        ...(to === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        ...(to === "RETURNED" ? { returnedAt: new Date() } : {}),
        ...(plan.stock ? { stockDeducted: plan.stock === "take" } : {}),
        logs: { create: { fromStatus: order.status, toStatus: to, actor, note: note?.slice(0, 500) } },
      },
    });
    return plan.stock !== null;
  });
  // Stock shown on product pages changed.
  if (stockMoved) revalidateTag("products", "max");
  const trigger = TRIGGER_OF_STATUS[to];
  if (trigger) await fireOrderEvent(orderId, trigger);
}
