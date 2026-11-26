// Changing the products of an order that has not left with a carrier yet. Pure: input checks and the stock each
// colour gives or takes. The order's own write lives in lib/orders.ts (editOrderItems).
import { z } from "zod";

const money = z.coerce.number().int().min(0).max(10_000_000);

const lines = z
  .array(z.object({ variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(100), unitPrice: z.number().int().min(0).max(10_000_000) }))
  .min(1)
  .max(30)
  // One line per colour: the form merges them, and the stock count relies on it.
  .refine((all) => new Set(all.map((l) => l.variantId)).size === all.length);

export const orderEditInput = z.object({
  orderId: z.string().min(1).max(40),
  items: z.string().transform((s, ctx) => {
    try {
      return lines.parse(JSON.parse(s));
    } catch {
      ctx.addIssue({ code: "custom", message: "items" });
      return z.NEVER;
    }
  }),
  shippingFee: money,
  discount: money,
});

export type OrderEditInput = z.infer<typeof orderEditInput>;

/**
 * How many more pieces of each colour the order holds after the change (negative: pieces it lets go).
 * Colours whose quantity did not move are left out.
 */
export function stockChanges(before: { variantId: string; quantity: number }[], after: { variantId: string; qty: number }[]) {
  const change = new Map<string, number>();
  for (const b of before) change.set(b.variantId, (change.get(b.variantId) ?? 0) - b.quantity);
  for (const a of after) change.set(a.variantId, (change.get(a.variantId) ?? 0) + a.qty);
  for (const [id, d] of change) if (d === 0) change.delete(id);
  return change;
}

/** A pack discount stays only as far as the new discount still covers it; the rest of the discount shows as a plain one. */
export const keptBundleDiscount = (bundleDiscount: number, discount: number) => Math.min(bundleDiscount, discount);
