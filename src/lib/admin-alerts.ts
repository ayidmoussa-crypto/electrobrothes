// What needs the team's attention, gathered in one place (the bell in the side rail) instead of banners on each page.
// Pure: the counts come from admin-alerts-data.ts, so the rules are tested without a database.
import type { Tr } from "./admin-tr";

export type AlertTone = "danger" | "warning" | "info";
export type AlertGroupId = "orders" | "messages" | "stock" | "reviews" | "finance" | "system";
/** `code` holds setting names or paths, shown left to right on their own line. */
export type AlertItem = { id: string; tone: AlertTone; title: string; detail?: string; code?: string; href: string };
export type AlertGroup = { id: AlertGroupId; title: string; items: AlertItem[] };

export type AlertCounts = {
  newOrders: number;
  /** Hours since the oldest order still waiting for a call. */
  oldestNewHours: number | null;
  readyToShip: number;
  outOfStock: number;
  /** At or under their alert level, still above zero. */
  lowStock: number;
  /** The emptiest of those colours, named, so each one opens its product. */
  stockList: { id: string; productId: string; name: string; left: number }[];
  unreadMessages: number;
  unreadChats: number;
  whatsappConnected: boolean;
  pendingReviews: number;
  negativeReviews: number;
  externalPending: number;
  /** Active colours in stock with no purchase price, so profit is guessed. */
  variantsWithoutCost: number;
  emailReady: boolean;
};

/** An order waiting this long for a call turns red. */
export const LATE_CALL_HOURS = 24;

const RANK: Record<AlertTone, number> = { danger: 0, warning: 1, info: 2 };

/** The groups with something in them, most urgent item first. The confirmation team sees orders, messages and setup only. */
export function buildAlerts(c: AlertCounts, role: "OWNER" | "AGENT", tr: Tr): AlertGroup[] {
  const owner = role === "OWNER";
  const raw: { id: AlertGroupId; title: string; items: (AlertItem | false | 0)[] }[] = [
    {
      id: "orders",
      title: tr("الطلبات", "Orders"),
      items: [
        c.newOrders && {
          id: "new-orders",
          tone: c.oldestNewHours !== null && c.oldestNewHours >= LATE_CALL_HOURS ? "danger" : "warning",
          title: tr(`${c.newOrders} طلب جديد كيتسنى المكالمة`, `${c.newOrders} new orders waiting for a call`),
          detail: c.oldestNewHours === null ? undefined : c.oldestNewHours < 1 ? tr("أقدم واحد وصل دابا", "The oldest just came in") : tr(`أقدم واحد هادي ${c.oldestNewHours} ساعة`, `The oldest came in ${c.oldestNewHours} h ago`),
          href: "/admin/orders?status=NEW",
        },
        c.readyToShip && {
          id: "ready",
          tone: "info",
          title: tr(`${c.readyToShip} طلب مؤكَّد كيتسنى الشحن`, `${c.readyToShip} confirmed orders waiting to ship`),
          href: "/admin/orders?status=CONFIRMED",
        },
      ],
    },
    {
      id: "messages",
      title: tr("الرسائل", "Messages"),
      items: [
        c.unreadMessages && {
          id: "unread",
          tone: "warning",
          title: tr(`${c.unreadMessages} رسالة ما تقراتش`, `${c.unreadMessages} unread messages`),
          detail: tr(`فـ ${c.unreadChats} محادثة`, `in ${c.unreadChats} conversations`),
          href: "/admin/inbox",
        },
      ],
    },
    {
      id: "stock",
      title: tr("المخزون", "Stock"),
      items: owner
        ? [
            ...c.stockList.map((v): AlertItem => ({
              id: `stock-${v.id}`,
              tone: v.left <= 0 ? "danger" : "warning",
              title: v.name,
              detail: v.left <= 0 ? tr("سالا من المخزون", "Out of stock") : tr(`بقي ${v.left}`, `${v.left} left`),
              href: `/admin/products/${v.productId}`,
            })),
            c.outOfStock + c.lowStock > c.stockList.length && {
              id: "stock-more",
              tone: "info",
              title: tr(`+${c.outOfStock + c.lowStock - c.stockList.length} لون آخر قرب يسالي`, `+${c.outOfStock + c.lowStock - c.stockList.length} more colours running low`),
              href: "/admin/products",
            },
          ]
        : [],
    },
    {
      id: "reviews",
      title: tr("التقييمات", "Reviews"),
      items: owner
        ? [
            c.negativeReviews && {
              id: "negative",
              tone: "danger",
              title: tr(`${c.negativeReviews} تقييم سلبي كيتسنى`, `${c.negativeReviews} negative reviews waiting`),
              detail: tr("اتصل بالزبون قبل ما تقرر.", "Call the customer before you decide."),
              href: "/admin/reviews",
            },
            c.pendingReviews - c.negativeReviews > 0 && {
              id: "pending",
              tone: "info",
              title: tr(`${c.pendingReviews - c.negativeReviews} تقييم كيتسنى الموافقة`, `${c.pendingReviews - c.negativeReviews} reviews waiting for approval`),
              href: "/admin/reviews",
            },
            c.externalPending && { id: "external", tone: "info", title: tr(`${c.externalPending} تقييم خارجي كيتسنى تأكيدك`, `${c.externalPending} external ratings to check`), href: "/admin/reviews" },
          ]
        : [],
    },
    {
      id: "finance",
      title: tr("المالية", "Finance"),
      items: owner
        ? [
            c.variantsWithoutCost && {
              id: "no-cost",
              tone: "warning",
              title: tr(`${c.variantsWithoutCost} لون فالمخزون بلا ثمن الشراء`, `${c.variantsWithoutCost} colours in stock have no purchase price`),
              detail: tr("الربح ما يكونش دقيق حتى تكمّلهم.", "Profit is not exact until you fill them in."),
              href: "/admin/finance",
            },
          ]
        : [],
    },
    {
      id: "system",
      title: tr("الإعدادات", "Setup"),
      items: [
        !c.whatsappConnected && {
          id: "whatsapp",
          tone: "warning",
          title: tr("واتساب مازال ما مربوطش", "WhatsApp is not connected"),
          detail: tr("الرسائل والأتمتة كيتسناو حتى يتربط. خاص هادو فـ Vercel، والـ webhook فـ Meta:", "Messages and automations wait until it is. These are needed in Vercel, and the webhook in Meta:"),
          code: "WHATSAPP_TOKEN · WHATSAPP_PHONE_NUMBER_ID · WHATSAPP_APP_SECRET · WHATSAPP_VERIFY_TOKEN · /api/webhooks/whatsapp",
          href: "/admin/inbox",
        },
        owner &&
          !c.emailReady && {
            id: "email",
            tone: "warning",
            title: tr("إشعارات الإيميل ما خدامينش", "Email alerts are off"),
            detail: tr("خاص إعدادات SMTP وإيميل الإشعارات، ولا ما كيوصلك حتى إيميل على الطلبات الجداد.", "SMTP and a notification address are needed, or no email reaches you about new orders."),
            href: "/admin/settings",
          },
      ],
    },
  ];
  return raw
    .map((g): AlertGroup => ({ ...g, items: g.items.filter((i): i is AlertItem => !!i).sort((a, b) => RANK[a.tone] - RANK[b.tone]) }))
    .filter((g) => g.items.length);
}
