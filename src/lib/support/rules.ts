import { createHmac, timingSafeEqual } from "node:crypto";

// Pure rules of the after-sales support chat (no database, no network), so they can be tested directly.

// ───────── The private support link ─────────

const sign = (orderId: string, secret: string) => createHmac("sha256", secret).update(`support:${orderId}`).digest("base64url").slice(0, 32);

/** "<orderId>-<signature>": one link per order, which cannot be guessed and differs from the review link. */
export const supportToken = (orderId: string, secret: string) => `${orderId}-${sign(orderId, secret)}`;

/** The order id when the link is authentic, or null. */
export function readSupportToken(token: string, secret: string) {
  const dash = token.indexOf("-");
  if (dash < 1) return null;
  const orderId = token.slice(0, dash);
  const given = Buffer.from(token.slice(dash + 1));
  const expected = Buffer.from(sign(orderId, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? orderId : null;
}

// ───────── Limits ─────────

/** Every support AI call is recorded under this actor: the chat has its own monthly ceiling. */
export const SUPPORT_ACTOR = "support-chat";

/** Longest customer message, in characters. */
export const MAX_MESSAGE_LENGTH = 800;
/** Customer messages in one conversation: past this, the owner takes over. */
export const MAX_CUSTOMER_MESSAGES = 25;
/** Longest troubleshooting notes per product. */
export const SUPPORT_GUIDE_MAX = 6000;
/** Messages per order per hour, against scripts and loops. */
export const MAX_MESSAGES_PER_HOUR = 30;

// ───────── Problems and outcomes ─────────

export const PROBLEM_CATEGORIES = {
  battery: { ar: "البطارية", en: "Battery" },
  charging: { ar: "الشحن", en: "Charging" },
  power: { ar: "ما كيشعلش", en: "Won't turn on" },
  connection: { ar: "الاتصال (بلوتوث، ويفي)", en: "Connection (Bluetooth, Wi-Fi)" },
  sound: { ar: "الصوت", en: "Sound" },
  screen: { ar: "الشاشة", en: "Screen" },
  buttons: { ar: "الأزرار واللمس", en: "Buttons and touch" },
  setup: { ar: "الاستعمال والإعدادات", en: "Setup and use" },
  physical: { ar: "كسر ولا ضرر", en: "Broken or damaged" },
  other: { ar: "أخرى", en: "Other" },
} as const;

export type ProblemCategory = keyof typeof PROBLEM_CATEGORIES;
export const PROBLEM_KEYS = Object.keys(PROBLEM_CATEGORIES) as ProblemCategory[];
export const isProblemCategory = (v: unknown): v is ProblemCategory => typeof v === "string" && v in PROBLEM_CATEGORIES;

export type SupportStatusKey = "OPEN" | "ESCALATED" | "SOLVED" | "REPLACED" | "UNSOLVED";

export const STATUS_LABEL: Record<SupportStatusKey, { ar: string; en: string }> = {
  OPEN: { ar: "مع المساعد", en: "With the assistant" },
  ESCALATED: { ar: "كيتسنى قرارك", en: "Waiting for you" },
  SOLVED: { ar: "تحل", en: "Solved" },
  REPLACED: { ar: "تبدل", en: "Replaced" },
  UNSOLVED: { ar: "ما تحلش", en: "Not solved" },
};

/** Badge tone of each status (components/ui/Badge). */
export const STATUS_TONE: Record<SupportStatusKey, "neutral" | "warning" | "success" | "ink" | "danger"> = { OPEN: "neutral", ESCALATED: "warning", SOLVED: "success", REPLACED: "ink", UNSOLVED: "danger" };

/** The conversation is still running: the customer can write. */
export const isActive = (status: SupportStatusKey) => status === "OPEN" || status === "ESCALATED";

/** The warranty end, from the delivery date (the order date when it was never recorded). */
export function warrantyState(deliveredAt: Date, months: number, now = new Date()) {
  const endsAt = new Date(deliveredAt);
  endsAt.setMonth(endsAt.getMonth() + months);
  return { endsAt, covered: months > 0 && now <= endsAt };
}

// ───────── Figures for the admin page ─────────

export type TicketRow = { status: SupportStatusKey; solvedByAi: boolean; verdict: string | null; category: string | null; productId: string | null; productName: string };

/** Closed without a replacement because the owner found the cause in the use (water, charger, fall...). */
export const isCustomerCause = (r: { status: SupportStatusKey; verdict: string | null }) => r.status === "UNSOLVED" && r.verdict === "misuse";

type Tally = { total: number; solvedByAi: number; solvedByOwner: number; replaced: number; customerCause: number; unsolved: number; waiting: number; open: number };

const empty = (): Tally => ({ total: 0, solvedByAi: 0, solvedByOwner: 0, replaced: 0, customerCause: 0, unsolved: 0, waiting: 0, open: 0 });

function add(t: Tally, r: TicketRow) {
  t.total++;
  if (r.status === "SOLVED" && r.solvedByAi) t.solvedByAi++;
  else if (r.status === "SOLVED") t.solvedByOwner++;
  else if (r.status === "REPLACED") t.replaced++;
  else if (isCustomerCause(r)) t.customerCause++;
  else if (r.status === "UNSOLVED") t.unsolved++;
  else if (r.status === "ESCALATED") t.waiting++;
  else t.open++;
}

/** Totals, then per product and per kind of problem, most problems first. */
export function supportStats(rows: TicketRow[]) {
  const totals = empty();
  const products = new Map<string, Tally & { name: string }>();
  const categories = new Map<string, Tally>();
  for (const r of rows) {
    add(totals, r);
    const pKey = r.productId ?? `name:${r.productName}`;
    const p = products.get(pKey) ?? { ...empty(), name: r.productName };
    add(p, r);
    products.set(pKey, p);
    const cKey = isProblemCategory(r.category) ? r.category : "other";
    const c = categories.get(cKey) ?? empty();
    add(c, r);
    categories.set(cKey, c);
  }
  const byTotal = <T extends Tally>(a: T, b: T) => b.total - a.total;
  return {
    totals,
    /** Share of closed problems the AI fixed on its own, 0 to 100; null before any is closed. */
    aiRate: (() => {
      const closed = totals.solvedByAi + totals.solvedByOwner + totals.replaced + totals.customerCause + totals.unsolved;
      return closed ? Math.round((totals.solvedByAi / closed) * 100) : null;
    })(),
    products: [...products.entries()].map(([id, t]) => ({ id, ...t })).sort(byTotal),
    categories: [...categories.entries()].map(([key, t]) => ({ key: key as ProblemCategory, ...t })).sort(byTotal),
  };
}

// ───────── Thank-you coupon ─────────

// No 0/O or 1/I: the customer may type it by hand.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** "MERCI-XXXXXX": a personal, hard-to-guess code. `pick(n)` returns a random integer in [0, n). */
export const rewardCode = (pick: (n: number) => number) => `MERCI-${Array.from({ length: 6 }, () => CODE_ALPHABET[pick(CODE_ALPHABET.length)]).join("")}`;

/** The reward's last valid moment: the end of the last day, so "30 days" is never cut short. */
export function rewardExpiry(days: number, now = new Date()) {
  const end = new Date(now.getTime() + days * 86_400_000);
  end.setUTCHours(23, 59, 59, 0);
  return end;
}

// ───────── Sending the link ─────────

/** The WhatsApp message with the private support link, sent by hand from the order page. */
export function supportWhatsappMessage(customerName: string, link: string) {
  const first = customerName.trim().split(/\s+/)[0] || customerName.trim();
  return [
    `السلام عليكم ${first}، معك ElectroBrothers 👋`,
    "إلا تلاقيتي شي مشكل تقني فالمنتوج ديالك، هادا رابط الدعم الخاص بيك. كتب لينا المشكل وغادي نعاونوك نحلوه:",
    link,
  ].join("\n");
}
