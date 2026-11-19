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

/**
 * Who may use the support chat: a customer who has received at least one order. The link's order gives the phone;
 * every delivered order of that phone is theirs to ask about. A cancelled or undelivered order alone opens nothing.
 */
export async function supportAccess(token: string) {
  const orderId = orderFromSupportToken(token);
  if (!orderId) return null;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { phone: true } });
  if (!order) return null;
  const delivered = await db.order.findMany({ where: { phone: order.phone, status: "DELIVERED" }, select: { id: true } });
  return delivered.length ? { phone: order.phone, orderIds: delivered.map((o) => o.id) } : null;
}

/** Everything the support page shows for a link, or null: a wrong link, or a customer who has received nothing yet. */
export async function supportPageData(token: string, ar: boolean): Promise<SupportView | null> {
  const access = await supportAccess(token);
  if (!access) return null;
  const orders = await db.order.findMany({
    where: { id: { in: access.orderIds } },
    orderBy: { deliveredAt: "desc" },
    select: {
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
  if (!orders.length) return null;
  const tickets = orders.flatMap((o) => o.supportTickets).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  // The newest thank-you code still usable.
  const codes = tickets.flatMap((t) => (t.rewardCode ? [t.rewardCode] : []));
  const coupons = codes.length ? await db.coupon.findMany({ where: { code: { in: codes } }, select: { code: true, value: true, expiresAt: true, usedCount: true, maxUses: true, isActive: true } }) : [];
  const now = new Date();
  const coupon = codes
    .map((c) => coupons.find((x) => x.code === c))
    .find((c) => c && c.isActive && (c.maxUses === null || c.usedCount < c.maxUses) && (!c.expiresAt || c.expiresAt > now));
  return {
    firstName: orders[0].customerName.trim().split(/\s+/)[0] ?? "",
    reward: coupon ? { code: coupon.code, percent: coupon.value, expiresAt: (coupon.expiresAt ?? now).toISOString() } : null,
    // Newest order first; the same product bought twice shows twice (each purchase has its own date and warranty).
    items: orders.flatMap((o) => o.items).map((i) => ({ id: i.id, name: ar ? i.nameAr : i.nameEn, option: i.variantLabel, image: i.variant?.product.images[0]?.url ?? null })),
    tickets: tickets.map((t) => ({
      id: t.id,
      itemId: t.orderItemId,
      productName: t.productName,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      messages: t.messages.map((m) => ({ id: m.id, role: m.role as "customer" | "ai" | "owner", text: m.text, createdAt: m.createdAt.toISOString() })),
    })),
  };
}
