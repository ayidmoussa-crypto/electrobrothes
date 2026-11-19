import "server-only";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { readSupportToken, supportToken, type SupportStatusKey } from "./rules";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 random characters (see .env.example).");
  return s;
};

export const supportLink = (orderId: string, locale: "ar" | "en" = "ar") => absoluteUrl(locale, `/support/${supportToken(orderId, secret())}`);
export const supportPath = (orderId: string) => `/support/${supportToken(orderId, secret())}`;
export const orderFromSupportToken = (token: string) => readSupportToken(token, secret());

export type SupportView = {
  firstName: string;
  /** The thank-you coupon, while it can still be used. */
  reward: { code: string; percent: number; expiresAt: string } | null;
  items: { id: string; name: string; option: string | null; image: string | null }[];
  tickets: {
    id: string;
    itemId: string | null;
    productName: string;
    status: SupportStatusKey;
    createdAt: string;
    messages: { id: string; role: "customer" | "ai" | "owner"; text: string; createdAt: string }[];
  }[];
};

/** Everything the support page shows for a link, or null: a wrong link, or an order not delivered. */
export async function supportPageData(token: string, ar: boolean): Promise<SupportView | null> {
  const orderId = orderFromSupportToken(token);
  if (!orderId) return null;
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      customerName: true,
      items: {
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          variantLabel: true,
          variant: { select: { product: { select: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } } },
        },
      },
      supportTickets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderItemId: true,
          productName: true,
          status: true,
          createdAt: true,
          rewardCode: true,
          messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, text: true, createdAt: true } },
        },
      },
    },
  });
  if (!order || order.status !== "DELIVERED") return null;
  const code = order.supportTickets.find((t) => t.rewardCode)?.rewardCode;
  const coupon = code ? await db.coupon.findUnique({ where: { code }, select: { code: true, value: true, expiresAt: true, usedCount: true, maxUses: true, isActive: true } }) : null;
  const usable = coupon && coupon.isActive && (coupon.maxUses === null || coupon.usedCount < coupon.maxUses) && (!coupon.expiresAt || coupon.expiresAt > new Date());
  return {
    firstName: order.customerName.trim().split(/\s+/)[0] ?? "",
    reward: usable ? { code: coupon.code, percent: coupon.value, expiresAt: (coupon.expiresAt ?? new Date()).toISOString() } : null,
    items: order.items.map((i) => ({ id: i.id, name: ar ? i.nameAr : i.nameEn, option: i.variantLabel, image: i.variant?.product.images[0]?.url ?? null })),
    tickets: order.supportTickets.map((t) => ({
      id: t.id,
      itemId: t.orderItemId,
      productName: t.productName,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      messages: t.messages.map((m) => ({ id: m.id, role: m.role as "customer" | "ai" | "owner", text: m.text, createdAt: m.createdAt.toISOString() })),
    })),
  };
}
