import "server-only";
import { db } from "./db";
import { TEMPLATE_LABEL, isTemplate } from "./landing";
import { orderBucket } from "./offers";

export type CampaignRow = {
  key: string;
  label: string;
  clicks: number;
  whatsapp: number;
  orders: number;
  confirmed: number;
  delivered: number;
  refused: number;
  cancelled: number;
  revenueDelivered: number;
};

const empty = (key: string, label: string): CampaignRow => ({ key, label, clicks: 0, whatsapp: 0, orders: 0, confirmed: 0, delivered: 0, refused: 0, cancelled: 0, revenueDelivered: 0 });

function addOrder(row: CampaignRow, status: string, total: number) {
  row.orders++;
  const b = orderBucket(status);
  // Delivered and refused orders were confirmed first: they count in "confirmed" too.
  if (b === "confirmed" || b === "delivered" || b === "refused") row.confirmed++;
  if (b === "delivered") {
    row.delivered++;
    row.revenueDelivered += total;
  }
  if (b === "refused") row.refused++;
  if (b === "cancelled") row.cancelled++;
}

/**
 * The studio's figures over the last `days` days: per home offer (clicks on "تسوّق الآن" and the orders that
 * followed within the cookie's 7 days) and per offer page template (clicks and orders from its form).
 */
export async function campaignStats(days = 30, lang: "ar" | "en" = "ar") {
  const since = new Date(Date.now() - days * 86_400_000);
  const [offers, events, orders] = await Promise.all([
    db.offer.findMany({ select: { id: true, name: true } }),
    db.campaignEvent.groupBy({ by: ["source", "type", "offerId", "template"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.order.findMany({
      where: { createdAt: { gte: since }, OR: [{ offerId: { not: null } }, { landingTemplate: { not: null } }] },
      select: { offerId: true, landingTemplate: true, status: true, total: true },
    }),
  ]);

  const byOffer = new Map(offers.map((o) => [o.id, empty(o.id, o.name)]));
  const byTemplate = new Map<string, CampaignRow>();
  const templateRow = (t: string) => {
    if (!byTemplate.has(t)) byTemplate.set(t, empty(t, isTemplate(t) ? TEMPLATE_LABEL[t][lang] : t));
    return byTemplate.get(t)!;
  };

  for (const e of events) {
    const n = e._count._all;
    const row = e.source === "home" ? (e.offerId ? byOffer.get(e.offerId) : undefined) : e.template ? templateRow(e.template) : undefined;
    if (!row) continue;
    if (e.type === "hero_cta_click") row.clicks += n;
    if (e.type === "whatsapp_click") row.whatsapp += n;
  }
  for (const o of orders) {
    if (o.landingTemplate) addOrder(templateRow(o.landingTemplate), o.status, o.total);
    else if (o.offerId) {
      const row = byOffer.get(o.offerId) ?? empty(o.offerId, lang === "en" ? "Deleted offer" : "عرض محذوف");
      byOffer.set(o.offerId, row);
      addOrder(row, o.status, o.total);
    }
  }

  return { days, offers: [...byOffer.values()], templates: [...byTemplate.values()] };
}

export type CampaignStats = Awaited<ReturnType<typeof campaignStats>>;
