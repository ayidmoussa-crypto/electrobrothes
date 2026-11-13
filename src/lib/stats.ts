import type { OrderStatus } from "./order-rules";

export type StatusCounts = Partial<Record<OrderStatus, number>>;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/**
 * COD funnel rates. Confirmation is measured on orders already handled (not still NEW);
 * delivery and return rates on orders that reached an outcome (delivered or returned).
 */
export function codRates(c: StatusCounts) {
  const n = (s: OrderStatus) => c[s] ?? 0;
  const total = Object.values(c).reduce((a, b) => a + (b ?? 0), 0);
  const handled = total - n("NEW");
  // A parcel on its way back was already refused: it counts as a return.
  const refused = n("RETURNING") + n("RETURNED");
  const confirmed = n("CONFIRMED") + n("SHIPPING") + n("DELIVERED") + refused;
  const outcome = n("DELIVERED") + refused;
  return {
    total,
    pending: n("NEW"),
    confirmation: pct(confirmed, handled),
    delivery: pct(n("DELIVERED"), outcome),
    returns: pct(refused, outcome),
  };
}
