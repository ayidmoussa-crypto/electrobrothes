import "server-only";
import type { Prisma, StockReason } from "@/generated/prisma/client";

// Every quantity change of a colour goes through moveStock: one atomic UPDATE that can never take
// stock below zero, plus a ledger row (StockMovement) in the same transaction.

type Tx = Prisma.TransactionClient;

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  OPENING: "رصيد افتتاحي",
  STOCK_IN: "إدخال مخزون",
  ADJUSTMENT: "تعديل / إخراج",
  CORRECTION: "تصحيح غلطة فالإدخال",
  ORDER_CONFIRMED: "تأكيد طلب",
  ORDER_CANCELLED: "إلغاء طلب",
  ORDER_RETURNED: "إرجاع طلب",
};

export const STOCK_REASON_LABEL_EN: Record<StockReason, string> = {
  OPENING: "Opening balance",
  STOCK_IN: "Stock in",
  ADJUSTMENT: "Adjustment / out",
  CORRECTION: "Entry mistake corrected",
  ORDER_CONFIRMED: "Order confirmed",
  ORDER_CANCELLED: "Order cancelled",
  ORDER_RETURNED: "Order returned",
};

/** "أسود · 128GB", or null for a product without colours. */
export const colorLabel = (v: { colorAr: string | null; storage: string | null }) => [v.colorAr, v.storage].filter(Boolean).join(" · ") || null;

/** Purchase price per unit: the colour's own price when set, else the product's. */
export const effectiveCost = (variantCost: number | null, productCost: number | null) => variantCost ?? productCost ?? null;

export class InsufficientStockError extends Error {
  constructor(public sku: string) {
    super("insufficient_stock");
  }
}

/**
 * Adds `delta` (negative to remove) to a colour's stock and logs it. Throws InsufficientStockError
 * when removing more than is there; returns the new stock.
 */
export async function moveStock(
  tx: Tx,
  move: { variantId: string; delta: number; reason: StockReason; actor: string; note?: string; order?: { id: string; number: string }; unitCost?: number | null },
) {
  const [row] = await tx.$queryRaw<{ stock: number }[]>`
    UPDATE "Variant" SET "stock" = "stock" + ${move.delta}
    WHERE "id" = ${move.variantId} AND "stock" + ${move.delta} >= 0
    RETURNING "stock"`;
  const v = await tx.variant.findUniqueOrThrow({
    where: { id: move.variantId },
    select: { sku: true, colorAr: true, storage: true, costPrice: true, productId: true, product: { select: { nameAr: true, costPrice: true } } },
  });
  if (!row) throw new InsufficientStockError(v.sku);

  await tx.stockMovement.create({
    data: {
      productId: v.productId,
      variantId: move.variantId,
      productName: v.product.nameAr,
      sku: v.sku,
      colorLabel: colorLabel(v),
      delta: move.delta,
      stockAfter: row.stock,
      reason: move.reason,
      unitCost: move.unitCost ?? effectiveCost(v.costPrice, v.product.costPrice),
      orderId: move.order?.id,
      orderNumber: move.order?.number,
      actor: move.actor,
      note: move.note?.slice(0, 300),
    },
  });
  return row.stock;
}
