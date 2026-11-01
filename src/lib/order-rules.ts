// Pure order rules shared by checkout, admin and tests. No database access here.

export const ORDER_STATUSES = ["NEW", "CONFIRMED", "SHIPPING", "DELIVERED", "RETURNED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// NEW → CONFIRMED (after the confirmation call) → SHIPPING → DELIVERED / RETURNED; cancel any time before delivery.
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED", "NEW"],
  SHIPPING: ["DELIVERED", "RETURNED", "CANCELLED"],
  DELIVERED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: ["NEW"],
};

export const allowedNext = (from: OrderStatus) => NEXT[from];

/**
 * What a status change does to inventory. Stock is taken when the order is confirmed
 * and given back when it is cancelled, returned or sent back to NEW.
 */
export function transitionPlan(from: OrderStatus, to: OrderStatus, stockDeducted: boolean) {
  if (!NEXT[from].includes(to)) return { allowed: false as const };
  const holdsStock = to === "CONFIRMED" || to === "SHIPPING" || to === "DELIVERED";
  const stock = holdsStock && !stockDeducted ? "take" : !holdsStock && stockDeducted ? "give" : null;
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
