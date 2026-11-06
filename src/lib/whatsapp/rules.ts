// WhatsApp Cloud API rules with no network or database, following Meta's documentation:
// signature on the raw body, webhook shape, the 24-hour window, and status order.
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const given = Buffer.from(header.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const WINDOW_MS = 24 * 3600 * 1000;

/** Free text is only allowed for 24 hours after the customer's last message; after that, templates only. */
export const windowOpen = (lastInboundAt: Date | null, now = Date.now()) => !!lastInboundAt && now - lastInboundAt.getTime() < WINDOW_MS;

const TYPE_LABEL: Record<string, string> = {
  image: "صورة",
  video: "فيديو",
  audio: "رسالة صوتية",
  document: "ملف",
  sticker: "ملصق",
  location: "موقع",
  contacts: "جهة اتصال",
  reaction: "تفاعل",
};

export type InboundMessage = { wamid: string; phone: string; name: string | null; type: string; body: string; at: Date };
export type StatusUpdate = { wamid: string; status: string; error: string | null };

type Raw = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          image?: { caption?: string };
          video?: { caption?: string };
          document?: { caption?: string; filename?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
          reaction?: { emoji?: string };
        }[];
        statuses?: { id?: string; status?: string; errors?: { title?: string; message?: string; code?: number }[] }[];
      };
    }[];
  }[];
};

function messageBody(m: NonNullable<NonNullable<NonNullable<NonNullable<Raw["entry"]>[number]["changes"]>[number]["value"]>["messages"]>[number]) {
  const text =
    m.text?.body ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    m.image?.caption ??
    m.video?.caption ??
    m.document?.caption ??
    m.document?.filename ??
    m.reaction?.emoji;
  const label = TYPE_LABEL[m.type ?? ""];
  if (text) return label && m.type !== "reaction" ? `[${label}] ${text}` : text;
  return label ? `[${label}]` : "[رسالة غير مدعومة]";
}

/** Pulls messages and delivery updates out of one webhook call; anything malformed is skipped, never thrown. */
export function parseWebhook(payload: unknown): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  for (const entry of (payload as Raw)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      for (const m of value.messages ?? []) {
        if (!m.id || !m.from) continue;
        const seconds = Number(m.timestamp);
        const contact = value.contacts?.find((c) => c.wa_id === m.from) ?? value.contacts?.[0];
        messages.push({
          wamid: m.id,
          phone: `+${m.from.replace(/\D/g, "")}`,
          name: contact?.profile?.name?.slice(0, 80) ?? null,
          type: m.type ?? "unknown",
          body: messageBody(m).slice(0, 4096),
          at: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date(),
        });
      }
      for (const s of value.statuses ?? []) {
        if (!s.id || !s.status) continue;
        const err = s.errors?.[0];
        statuses.push({ wamid: s.id, status: s.status, error: err ? `${err.code ?? ""} ${err.message ?? err.title ?? ""}`.trim().slice(0, 300) : null });
      }
    }
  }
  return { messages, statuses };
}

const RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, played: 3 };

/** Webhooks can arrive out of order: a late "delivered" must not overwrite "read". A failure always shows. */
export function nextStatus(current: string | null, incoming: string) {
  if (incoming === "failed") return "failed";
  if (current === "failed") return current;
  return (RANK[incoming] ?? 0) > (RANK[current ?? ""] ?? 0) ? incoming : current;
}
