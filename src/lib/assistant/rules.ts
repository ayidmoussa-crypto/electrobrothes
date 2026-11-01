import { TIME_ZONE } from "@/lib/time";

// Pure rules of the admin assistant (no database, no network), so they can be tested directly.

export const HAIKU = "claude-haiku-5-5";
export const SONNET = "claude-sonnet-5-5";

// US dollars per million tokens, Anthropic list prices. Update here when they change.
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  [HAIKU]: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  [SONNET]: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};
// A refused Sonnet request can be served by another model: count it high rather than under the ceiling.
const UNKNOWN_MODEL = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

export type Tokens = { input: number; output: number; cacheRead?: number; cacheWrite?: number };

/** Cost of one API call in millionths of a dollar. A token at $1 per million is exactly 1 micro. */
export function costMicros(model: string, t: Tokens) {
  const p = PRICES[model] ?? UNKNOWN_MODEL;
  return Math.ceil(t.input * p.input + t.output * p.output + (t.cacheRead ?? 0) * p.cacheRead + (t.cacheWrite ?? 0) * p.cacheWrite);
}

const monthFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: TIME_ZONE });

/** The budget month, "YYYY-MM" in Moroccan time. */
export const budgetMonth = (now = new Date()) => monthFormat.format(now).slice(0, 7);

export const overBudget = (spentMicros: number, capCents: number) => spentMicros >= capCents * 10_000;

export type StockMode = "add" | "remove" | "set";

/** The stock move for a request, given the current quantity. "set" with 0 is "sold out". */
export function stockDelta(mode: StockMode, quantity: number, current: number) {
  if (mode === "add") return quantity;
  if (mode === "remove") return -quantity;
  return quantity - current;
}

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** The real type of a base64 image from its first bytes; a declared type is not trusted. */
export function sniffImage(base64: string): ImageType | null {
  const head = Buffer.from(base64.slice(0, 24), "base64");
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && head.toString("latin1", 1, 4) === "PNG") return "image/png";
  if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** What a stored image gives Claude: only these formats can be compared with a photo (SVG cannot). */
export const comparableImage = (contentType: string | null): ImageType | null => {
  const type = contentType?.split(";")[0].trim().toLowerCase();
  return type === "image/jpeg" || type === "image/png" || type === "image/webp" ? type : null;
};

/** Store images may only be fetched from this site or from Cloudinary. */
export function storeImageUrl(url: string, origin: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return new URL(url, origin).href;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "res.cloudinary.com" ? u.href : null;
  } catch {
    return null;
  }
}

/** The operation's identity for "you just recorded this": same product, colour and quantity. */
export type OperationKey =
  | { kind: "STOCK_CHANGE"; variant_id: string; mode: StockMode; quantity: number }
  | { kind: "DRAFT_PRODUCT"; name_en: string; colors: { color_ar: string | null; quantity: number }[] };

export function sameOperation(a: OperationKey, b: OperationKey) {
  if (a.kind === "STOCK_CHANGE" && b.kind === "STOCK_CHANGE") return a.variant_id === b.variant_id && a.mode === b.mode && a.quantity === b.quantity;
  if (a.kind === "DRAFT_PRODUCT" && b.kind === "DRAFT_PRODUCT") {
    const colors = (k: typeof a) => k.colors.map((c) => `${c.color_ar ?? ""}:${c.quantity}`).sort().join("|");
    return a.name_en.trim().toLowerCase() === b.name_en.trim().toLowerCase() && colors(a) === colors(b);
  }
  return false;
}

/** The letters the admin wrote in. Product names are often Latin, so any Arabic letter means Arabic. */
export function replyScript(text: string): "arabic" | "latin" {
  return /\p{Script=Arabic}/u.test(text) || !/\p{Script=Latin}/u.test(text) ? "arabic" : "latin";
}

/** Last line of defence: database ids and tool field names never reach the admin's screen. */
export function scrubInternalIds(text: string) {
  return text
    .replace(/\b(?:product|variant|proposal|category|brand)_id\b\s*[:=]?\s*[\w-]*/gi, "")
    .replace(/\bc[a-z0-9]{24}\b/g, "")
    .replace(/[(（\[]\s*[)）\]]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type AssistantCard = {
  id: string;
  kind: "STOCK_CHANGE" | "DRAFT_PRODUCT";
  status: "PENDING" | "APPLIED" | "CANCELLED" | "EXPIRED" | "UNDONE";
  summary: string;
  title: string;
  image: string | null;
  rows: { label: string; value: string }[];
  warning?: string;
};

export type AssistantChoice = {
  productId: string;
  name: string;
  brand: string;
  image: string | null;
  colors: string[];
};

export type AssistantUsageView = { spentMicros: number; capCents: number; configured: boolean };

export type AssistantReply = {
  reply: string;
  model: string;
  cards: AssistantCard[];
  choices: { question: string; options: AssistantChoice[] } | null;
  usage: AssistantUsageView;
};
