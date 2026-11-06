// Packs ("باكات"): a set of products sold together for one price. Pure functions shared by the cart,
// the order form and the order action, so the customer always sees the discount the server will give.
//
// A pack is never a separate thing in the cart: its products go in as ordinary lines, and whenever every
// product of a pack is in the cart the difference to the pack price comes off as a discount. Any colour
// of a product counts, and the cheapest units are the ones matched, so the discount can never be gamed.

export type BundleRule = { id: string; price: number; items: { productId: string; quantity: number }[] };
export type BundleUnitLine = { productId: string; unitPrice: number; quantity: number };
export type AppliedBundle = { bundleId: string; times: number; saving: number };

/** Most packs a cart can hold of one kind; also bounds the loop below. */
const MAX_TIMES = 10;

export function bundleDiscount(lines: BundleUnitLine[], bundles: BundleRule[]): { discount: number; applied: AppliedBundle[] } {
  // Every unit in the cart, per product, cheapest first.
  const pool = new Map<string, number[]>();
  for (const l of lines) {
    const units = pool.get(l.productId) ?? [];
    for (let i = 0; i < l.quantity; i++) units.push(l.unitPrice);
    pool.set(l.productId, units);
  }
  for (const units of pool.values()) units.sort((a, b) => a - b);

  /** What the pack's products cost bought one by one right now, or null if one is missing. */
  const listPrice = (b: BundleRule) => {
    let sum = 0;
    for (const item of b.items) {
      const units = pool.get(item.productId) ?? [];
      if (units.length < item.quantity) return null;
      for (let i = 0; i < item.quantity; i++) sum += units[i];
    }
    return sum;
  };

  const applied = new Map<string, AppliedBundle>();
  // Greedy: always take the pack that saves the most next, until none fits or none saves anything.
  for (let guard = 0; guard < MAX_TIMES * Math.max(1, bundles.length); guard++) {
    let best: { b: BundleRule; saving: number } | null = null;
    for (const b of bundles) {
      if (!b.items.length || (applied.get(b.id)?.times ?? 0) >= MAX_TIMES) continue;
      const list = listPrice(b);
      if (list === null) continue;
      const saving = list - b.price;
      if (saving > 0 && (!best || saving > best.saving)) best = { b, saving };
    }
    if (!best) break;
    for (const item of best.b.items) pool.get(item.productId)!.splice(0, item.quantity);
    const prev = applied.get(best.b.id) ?? { bundleId: best.b.id, times: 0, saving: 0 };
    applied.set(best.b.id, { ...prev, times: prev.times + 1, saving: prev.saving + best.saving });
  }

  const list = [...applied.values()];
  return { discount: list.reduce((s, a) => s + a.saving, 0), applied: list };
}

/** Price of a pack's products bought separately, each at its cheapest colour in stock. */
export const separatePrice = (items: { quantity: number; minPrice: number }[]) => items.reduce((s, i) => s + i.minPrice * i.quantity, 0);
