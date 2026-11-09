// What can start an automation, whether it still makes sense when its delay ends, and what fills a template.
// Pure: the sending lives in lib/automations.ts.
import type { OrderStatus } from "./order-rules";

export const TRIGGERS = {
  order_created: "طلب جديد",
  order_confirmed: "تأكيد الطلب",
  order_shipping: "خروج الطلب للشحن",
  out_for_delivery: "خارج للتوصيل اليوم",
  delivery_failed: "محاولة توصيل فاشلة",
  order_delivered: "تم التسليم",
  order_returning: "جاري الإرجاع",
  order_returned: "رجع الطلب",
  order_cancelled: "إلغاء الطلب",
} as const;

export type Trigger = keyof typeof TRIGGERS;
export const isTrigger = (s: string): s is Trigger => s in TRIGGERS;

// The message is dropped if the order has moved on by the time the delay ends: a "please confirm"
// reminder must never reach a customer who already confirmed, or who cancelled.
const STILL_VALID: Record<Trigger, OrderStatus[]> = {
  order_created: ["NEW"],
  order_confirmed: ["CONFIRMED", "SHIPPING"],
  order_shipping: ["SHIPPING"],
  out_for_delivery: ["SHIPPING"],
  delivery_failed: ["SHIPPING"],
  order_delivered: ["DELIVERED"],
  order_returning: ["RETURNING"],
  order_returned: ["RETURNED"],
  order_cancelled: ["CANCELLED"],
};

export const triggerStillValid = (trigger: string, status: OrderStatus) => isTrigger(trigger) && STILL_VALID[trigger].includes(status);

export const TRIGGER_OF_STATUS: Partial<Record<OrderStatus, Trigger>> = {
  CONFIRMED: "order_confirmed",
  SHIPPING: "order_shipping",
  DELIVERED: "order_delivered",
  RETURNING: "order_returning",
  RETURNED: "order_returned",
  CANCELLED: "order_cancelled",
};

export const PARAMS = {
  name: "اسم الزبون",
  number: "رقم الطلب",
  total: "المبلغ",
  products: "المنتجات",
  city: "المدينة",
  address: "العنوان",
  tracking: "رقم التتبع",
  review_link: "رابط التقييم",
} as const;

export type ParamKey = keyof typeof PARAMS;
export const isParam = (s: string): s is ParamKey => s in PARAMS;

/** A template refuses an empty value, so "tracking" with no number yet returns null and the job is held back. */
export function templateValues(keys: string[], values: Record<ParamKey, string | null>) {
  const out: string[] = [];
  for (const k of keys) {
    const v = isParam(k) ? values[k] : null;
    if (!v) return null;
    // Meta rejects line breaks, tabs and long runs of spaces in template values.
    out.push(v.replace(/\s+/g, " ").trim().slice(0, 1000));
  }
  return out;
}

export const RETRY_LIMIT = 3;
export const RETRY_MINUTES = 15;
