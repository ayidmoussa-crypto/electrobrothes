// Pure order rules shared by checkout, admin and tests. No database access here.

// In the order the owner reads them in the status menu.
export const ORDER_STATUSES = ["NEW", "CONFIRMED", "CANCELLED", "SHIPPING", "DELIVERED", "RETURNING", "RETURNED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// NEW → CONFIRMED (after the confirmation call) → SHIPPING → DELIVERED, or RETURNING → RETURNED when the
// parcel is refused; cancel any time before delivery. These are the steps the carrier's tracking moves too.
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED", "NEW"],
  SHIPPING: ["DELIVERED", "RETURNING", "RETURNED", "CANCELLED"],
  DELIVERED: ["RETURNING", "RETURNED"],
  // A refused parcel can still be delivered on a second try.
  RETURNING: ["RETURNED", "DELIVERED"],
  RETURNED: [],
  CANCELLED: ["NEW"],
};

export const allowedNext = (from: OrderStatus) => NEXT[from];

/**
 * Payment follows the status: a delivered order is paid (the carrier collected the cash). The only thing
 * set by hand is a payment made before shipping (bank transfer...), and then the carrier collects nothing.
 */
export type PaymentState = "PENDING" | "PREPAID" | "PAID" | "NONE";

export function paymentState(status: OrderStatus, prepaid: boolean): PaymentState {
  if (prepaid) return "PREPAID";
  if (status === "DELIVERED") return "PAID";
  if (status === "RETURNING" || status === "RETURNED" || status === "CANCELLED") return "NONE";
  return "PENDING";
}

/** "Paid before shipping" can be set or undone only while the parcel has not reached its end. */
export const canSetPrepaid = (status: OrderStatus) => status === "NEW" || status === "CONFIRMED" || status === "SHIPPING";

/** Set to delivered by hand before it ever left with the carrier: the owner handed it over himself. */
export const deliveredByHand = (from: OrderStatus, to: OrderStatus) => to === "DELIVERED" && (from === "NEW" || from === "CONFIRMED");

/**
 * Taken back from delivered to a step before delivery (a mistake corrected by hand): the delivery and the
 * cash recorded with it are undone. A return keeps them: the parcel did reach the customer.
 */
export const undoesDelivery = (from: OrderStatus, to: OrderStatus) =>
  from === "DELIVERED" && (to === "NEW" || to === "CONFIRMED" || to === "SHIPPING" || to === "CANCELLED");

/** The order's goods are out of the stock in this status. A parcel on its way back still is: it returns on RETURNED. */
export const holdsStock = (s: OrderStatus) => s === "CONFIRMED" || s === "SHIPPING" || s === "DELIVERED" || s === "RETURNING";

/** Cash the carrier collects at the door. */
export const cashToCollect = (total: number, prepaid: boolean) => (prepaid ? 0 : total);

/**
 * Why an order cannot be handed to a delivery company, or null when it can: only a confirmed order goes out,
 * and one that already has a parcel number has gone out already.
 */
export function shipBlock(status: OrderStatus, trackingNumber: string | null): "not_confirmed" | "has_tracking" | null {
  if (status !== "CONFIRMED") return "not_confirmed";
  if (trackingNumber) return "has_tracking";
  return null;
}

/**
 * Why an order cannot be deleted, or null when it can. Only orders that never left the shop go: new, confirmed
 * (no parcel number yet) or cancelled. A parcel that went out, was delivered or came back is part of the money and
 * the carrier's records; and a customer's review hangs on its order (without it the shop would hide the review).
 */
export function deleteBlock(status: OrderStatus, trackingNumber: string | null, reviews: number): "shipped" | "has_reviews" | null {
  if (status !== "NEW" && status !== "CONFIRMED" && status !== "CANCELLED") return "shipped";
  if (trackingNumber) return "shipped";
  if (reviews) return "has_reviews";
  return null;
}

/**
 * What a status change does to inventory. Stock is taken when the order is confirmed
 * and given back when it is cancelled, returned or sent back to NEW.
 * `manual`: the owner picked it by hand and may jump anywhere (he sometimes delivers an order himself);
 * the carrier's tracking follows the usual path only.
 */
export function transitionPlan(from: OrderStatus, to: OrderStatus, stockDeducted: boolean, manual = false) {
  if (from === to || (!manual && !NEXT[from].includes(to))) return { allowed: false as const };
  const stock = holdsStock(to) && !stockDeducted ? "take" : !holdsStock(to) && stockDeducted ? "give" : null;
  return { allowed: true as const, stock };
}

export type RiskInput = {
  blacklisted: boolean;
  recentOrdersSamePhone: number;
  fillSeconds: number | null;
  honeypotFilled: boolean;
  ordersFromIpLastHour: number;
  total: number;
};

/** 0 = clean. The admin sees the flags and calls risky orders first; only the blacklist blocks outright. */
export function assessRisk(i: RiskInput) {
  const flags: string[] = [];
  let score = 0;
  const add = (flag: string, points: number) => {
    flags.push(flag);
    score += points;
  };
  if (i.blacklisted) add("blacklisted", 100);
  if (i.honeypotFilled) add("bot_honeypot", 80);
  if (i.recentOrdersSamePhone > 0) add("duplicate_phone", 40);
  if (i.fillSeconds !== null && i.fillSeconds < 4) add("too_fast", 30);
  if (i.ordersFromIpLastHour >= 3) add("many_from_ip", 20);
  if (i.total >= 15000) add("high_value", 10);
  return { score: Math.min(score, 100), flags, block: i.blacklisted || i.honeypotFilled };
}

// No 0/O/1/I so numbers read out over the phone are unambiguous.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function newOrderNumber(random: (n: number) => Uint8Array) {
  const bytes = random(6);
  return `EB-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

export const ORDER_NUMBER = /^EB-[2-9A-HJ-NP-Z]{6}$/;
