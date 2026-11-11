import type { OrderStatus } from "./order-rules";

export type StaffRole = "OWNER" | "AGENT";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/** A confirmation agent only answers new orders: confirmed or cancelled. Everything after is the owner's. */
export const agentMayMove = (from: OrderStatus, to: OrderStatus) => from === "NEW" && (to === "CONFIRMED" || to === "CANCELLED");

/**
 * Who answered a new order, written with the status change. Leaving NEW credits the person who did it;
 * going back to NEW takes the credit away, so the order is counted again by whoever answers it next.
 */
export function handledUpdate(from: OrderStatus, to: OrderStatus, byId: string | undefined, now = new Date()) {
  if (to === "NEW") return { handledById: null, handledAt: null, handledAs: null };
  if (from === "NEW" && byId) return { handledById: byId, handledAt: now, handledAs: to };
  return {};
}

export type HandledOrder = { handledAs: OrderStatus | null; status: OrderStatus };
export type Pay = { payPerConfirmed: number; payPerDelivered: number };

/**
 * An agent's month, Egrow style: of the new orders they answered, how many they confirmed, how many of
 * those reached the customer, and what that earns them.
 */
export function agentStats(rows: HandledOrder[], pay: Pay) {
  const confirmedRows = rows.filter((r) => r.handledAs === "CONFIRMED");
  const confirmed = confirmedRows.length;
  const cancelled = rows.filter((r) => r.handledAs === "CANCELLED").length;
  const delivered = confirmedRows.filter((r) => r.status === "DELIVERED").length;
  // A parcel on its way back was already refused.
  const returned = confirmedRows.filter((r) => r.status === "RETURNING" || r.status === "RETURNED").length;
  const onTheWay = confirmedRows.filter((r) => r.status === "CONFIRMED" || r.status === "SHIPPING").length;
  const fromConfirmed = confirmed * pay.payPerConfirmed;
  const fromDelivered = delivered * pay.payPerDelivered;
  return {
    handled: rows.length,
    confirmed,
    cancelled,
    delivered,
    returned,
    onTheWay,
    confirmation: pct(confirmed, rows.length),
    delivery: pct(delivered, delivered + returned),
    fromConfirmed,
    fromDelivered,
    earnings: fromConfirmed + fromDelivered,
  };
}

/** "YYYY-MM" (or anything else → the current month) → that month's first instant and the next month's. */
export function monthRange(ym: string | undefined, now = new Date()) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym ?? "");
  const year = m ? Number(m[1]) : now.getUTCFullYear();
  const month = m ? Number(m[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end, key: start.toISOString().slice(0, 7) };
}

/** The month before a "YYYY-MM" key. */
export const previousMonth = (key: string) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
