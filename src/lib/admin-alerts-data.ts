import "server-only";
import { buildAlerts, type AlertCounts } from "./admin-alerts";
import type { Tr } from "./admin-tr";
import { db } from "./db";
import { waConfig } from "./whatsapp/client";

const pendingReview = { verified: true, isApproved: false, rejectedAt: null };

/** Small counts only, read on every admin page: the bell must never slow the panel down. */
export async function loadAlerts(role: "OWNER" | "AGENT", tr: Tr, ar: boolean) {
  const owner = role === "OWNER";
  const zero = Promise.resolve(0);
  const [newOrders, oldestNew, readyToShip, outOfStock, atAlert, unread, pendingReviews, negativeReviews, externalPending, variantsWithoutCost, settings] = await Promise.all([
    db.order.count({ where: { status: "NEW" } }),
    db.order.findFirst({ where: { status: "NEW" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.order.count({ where: { status: "CONFIRMED" } }),
    owner ? db.variant.count({ where: { stock: { lte: 0 }, product: { isActive: true } } }) : zero,
    owner ? db.variant.count({ where: { stock: { lte: db.variant.fields.lowStockAt }, product: { isActive: true } } }) : zero,
    db.waConversation.aggregate({ where: { unread: { gt: 0 } }, _sum: { unread: true }, _count: true }),
    owner ? db.review.count({ where: pendingReview }) : zero,
    owner ? db.review.count({ where: { ...pendingReview, rating: { lte: 2 } } }) : zero,
    owner ? db.externalRating.count({ where: { status: "PENDING" } }) : zero,
    // Same rule as the finance page: the colour's own price, else the product's.
    owner ? db.variant.count({ where: { costPrice: null, stock: { gt: 0 }, product: { isActive: true, costPrice: null } } }) : zero,
    owner ? db.settings.findUnique({ where: { id: 1 }, select: { notifyEmail: true } }) : null,
  ]);
  // The emptiest colours by name (products shown in the shop only), like the dashboard's old "running low" card.
  const low = owner
    ? await db.variant.findMany({
        where: { stock: { lte: db.variant.fields.lowStockAt }, product: { isActive: true } },
        select: { id: true, stock: true, colorAr: true, colorEn: true, storage: true, product: { select: { id: true, nameAr: true, nameEn: true } } },
        orderBy: [{ stock: "asc" }, { product: { nameAr: "asc" } }],
        take: 8,
      })
    : [];
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;
  const counts: AlertCounts = {
    newOrders,
    oldestNewHours: oldestNew ? Math.floor((Date.now() - oldestNew.createdAt.getTime()) / 3600_000) : null,
    readyToShip,
    outOfStock,
    lowStock: Math.max(0, atAlert - outOfStock),
    stockList: low.map((v) => ({
      id: v.id,
      productId: v.product.id,
      name: [ar ? v.product.nameAr : v.product.nameEn, ar ? v.colorAr : v.colorEn, v.storage].filter(Boolean).join(" · "),
      left: v.stock,
    })),
    unreadMessages: unread._sum.unread ?? 0,
    unreadChats: unread._count,
    whatsappConnected: !!waConfig(),
    pendingReviews,
    negativeReviews,
    externalPending,
    variantsWithoutCost,
    emailReady: !!(SMTP_HOST && SMTP_USER && SMTP_PASS && (settings?.notifyEmail || NOTIFY_EMAIL)),
  };
  return buildAlerts(counts, role, tr);
}
