// A parcel's journey and what each step means for the order. Pure: shared by the admin, the customer
// tracking page, tests, and (once connected) the carrier's API. Express Relais's own status names get
// mapped onto these keys when its documentation arrives.
import { allowedNext, type OrderStatus } from "../order-rules";

export const CARRIER_STATUSES = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERY_FAILED", "DELIVERED", "RETURNING", "RETURNED"] as const;
export type CarrierStatus = (typeof CARRIER_STATUSES)[number];

export const CARRIER_LABEL: Record<CarrierStatus, { ar: string; en: string }> = {
  PICKED_UP: { ar: "استلمته شركة التوصيل", en: "Picked up by the carrier" },
  IN_TRANSIT: { ar: "فالطريق", en: "In transit" },
  OUT_FOR_DELIVERY: { ar: "خارج للتوصيل اليوم", en: "Out for delivery" },
  DELIVERY_FAILED: { ar: "محاولة توصيل فاشلة", en: "Delivery attempt failed" },
  DELIVERED: { ar: "تم التسليم", en: "Delivered" },
  RETURNING: { ar: "راجع للمتجر", en: "On its way back" },
  RETURNED: { ar: "رجع للمتجر", en: "Returned" },
};

export const isCarrierStatus = (s: string): s is CarrierStatus => (CARRIER_STATUSES as readonly string[]).includes(s);

// The order status each step requires; the others leave the order where it is once it is shipping.
const TARGET: Record<CarrierStatus, OrderStatus> = {
  PICKED_UP: "SHIPPING",
  IN_TRANSIT: "SHIPPING",
  OUT_FOR_DELIVERY: "SHIPPING",
  DELIVERY_FAILED: "SHIPPING",
  RETURNING: "SHIPPING",
  DELIVERED: "DELIVERED",
  RETURNED: "RETURNED",
};

/**
 * The order status changes a carrier event causes, in order. A carrier can skip steps ("delivered" with
 * no "picked up" before it), so a confirmed order walks through SHIPPING first. Null: this event cannot
 * apply to an order in that status, e.g. a parcel moving for an order nobody confirmed or one already cancelled.
 */
export function carrierTransitions(current: OrderStatus, event: CarrierStatus): OrderStatus[] | null {
  const target = TARGET[event];
  if (current === target) return [];
  if (allowedNext(current).includes(target)) return [target];
  if (current === "CONFIRMED" && allowedNext("SHIPPING").includes(target)) return ["SHIPPING", target];
  return null;
}
