"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { clientIp, hit, verifyTurnstile } from "@/lib/guard";
import { notifyNewOrder } from "@/lib/notify";
import { ORDER_NUMBER } from "@/lib/order-rules";
import { ORDER_COOKIE, orderInput, placeOrder } from "@/lib/orders";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { computeTotals } from "@/lib/pricing";

const MAX_ORDERS_PER_IP_HOUR = 5;

export type OrderFormState = {
  error?: "rate_limited" | "captcha" | "unavailable" | "out_of_stock" | "blocked" | "coupon" | "unknown" | "invalid";
  fieldErrors?: Partial<Record<"name" | "phone" | "cityId" | "address" | "notes" | "items", string>>;
  couponError?: string;
  variantIds?: string[];
  values?: Record<string, string>;
};

export async function submitOrder(_prev: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const raw = Object.fromEntries([...formData].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const locale: Locale = routing.locales.includes(raw.locale as Locale) ? (raw.locale as Locale) : routing.defaultLocale;
  // Echo back what the customer typed (never the honeypot) so a failed submit keeps the form filled.
  const values = { name: raw.name ?? "", phone: raw.phone ?? "", cityId: raw.cityId ?? "", address: raw.address ?? "", notes: raw.notes ?? "", coupon: raw.coupon ?? "" };

  const parsed = orderInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: OrderFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof NonNullable<OrderFormState["fieldErrors"]>;
      fieldErrors[field] ??= issue.message;
    }
    return { error: "invalid", fieldErrors, values };
  }

  const ip = await clientIp();
  const fromIp = await hit(`order:ip:${ip}`, 3600);
  if (fromIp > MAX_ORDERS_PER_IP_HOUR) return { error: "rate_limited", values };

  if (!(await verifyTurnstile(raw["cf-turnstile-response"] ?? null, ip))) return { error: "captcha", values };

  const result = await placeOrder(parsed.data, {
    ip,
    userAgent: (await headers()).get("user-agent"),
    ordersFromIpLastHour: fromIp - 1,
  });
  if (!result.ok) return { error: result.error, couponError: result.couponError, variantIds: result.variantIds, values };

  // Email the shop after the response is sent; a re-submitted duplicate is not announced twice.
  if (!result.duplicate) after(() => notifyNewOrder(result.orderId));

  // The confirmation page shows the order only to the browser that placed it (no PII behind a guessable URL).
  (await cookies()).set(ORDER_COOKIE, result.orderId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  redirect({ href: "/order/confirmation", locale });
  return {};
}

// ───────────────────────── Coupon preview ─────────────────────────

/** Lets the form show the discount before submitting; the order action re-checks it. */
export async function previewCoupon(code: string, subtotal: number): Promise<{ discount?: number; error?: string }> {
  const clean = String(code).trim().toUpperCase().slice(0, 30);
  if (!clean || !Number.isInteger(subtotal) || subtotal < 0) return { error: "not_found" };
  // Slows down code guessing.
  if ((await hit(`coupon:ip:${await clientIp()}`, 3600)) > 30) return { error: "not_found" };

  const coupon = await db.coupon.findUnique({ where: { code: clean } });
  if (!coupon) return { error: "not_found" };
  const t = computeTotals({ items: [{ unitPrice: subtotal, quantity: 1 }], shippingFee: 0, freeShippingThreshold: Infinity, coupon });
  return t.couponError ? { error: t.couponError } : { discount: t.discount };
}

// ───────────────────────── Order tracking ─────────────────────────

export type TrackState = {
  error?: "invalid" | "not_found" | "rate_limited";
  values?: { number: string; phone: string };
  order?: {
    number: string;
    status: string;
    createdAt: string;
    cityName: string;
    total: number;
    items: { nameAr: string; nameEn: string; variantLabel: string | null; quantity: number }[];
    logs: { toStatus: string; createdAt: string }[];
  };
};

/** Number + phone must both match; POST so the phone never lands in a URL or server log. */
export async function trackOrder(_prev: TrackState, formData: FormData): Promise<TrackState> {
  // Echoed back so the form keeps what the customer typed after a failed attempt.
  const values = { number: String(formData.get("number") ?? "").slice(0, 20), phone: String(formData.get("phone") ?? "").slice(0, 20) };
  const number = values.number.trim().toUpperCase();
  const phone = normalizeMoroccanPhone(values.phone);
  if (!ORDER_NUMBER.test(number) || !phone) return { error: "invalid", values };

  const ip = await clientIp();
  if ((await hit(`track:ip:${ip}`, 3600)) > 30) return { error: "rate_limited", values };

  const order = await db.order.findFirst({
    where: { number, phone },
    include: {
      items: { select: { nameAr: true, nameEn: true, variantLabel: true, quantity: true } },
      logs: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return { error: "not_found", values };

  return {
    values,
    order: {
      number: order.number,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      cityName: order.cityName,
      total: order.total,
      items: order.items,
      logs: order.logs.map((l) => ({ toStatus: l.toStatus, createdAt: l.createdAt.toISOString() })),
    },
  };
}
