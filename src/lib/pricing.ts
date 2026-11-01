// Order totals in whole MAD. Pure functions: the checkout server action and the
// cart UI both call these so the customer always sees what the server charges.

export type CouponRule = {
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
};

export type CouponError = "inactive" | "not_started" | "expired" | "used_up" | "min_subtotal";

export function couponError(coupon: CouponRule, subtotal: number, now: Date): CouponError | null {
  if (!coupon.isActive) return "inactive";
  if (coupon.startsAt && coupon.startsAt > now) return "not_started";
  if (coupon.expiresAt && coupon.expiresAt <= now) return "expired";
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return "used_up";
  if (coupon.minSubtotal !== null && subtotal < coupon.minSubtotal) return "min_subtotal";
  return null;
}

export function computeTotals(input: {
  items: { unitPrice: number; quantity: number }[];
  shippingFee: number;
  freeShippingThreshold: number;
  coupon?: CouponRule | null;
  now?: Date;
}) {
  const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  let discount = 0;
  let error: CouponError | null = null;
  if (input.coupon) {
    error = couponError(input.coupon, subtotal, input.now ?? new Date());
    if (!error) {
      discount =
        input.coupon.type === "PERCENT"
          ? Math.floor((subtotal * input.coupon.value) / 100)
          : Math.min(input.coupon.value, subtotal);
    }
  }

  // Free delivery is judged on what the customer actually pays for the goods.
  const shipping = subtotal - discount >= input.freeShippingThreshold ? 0 : input.shippingFee;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping, couponError: error };
}
