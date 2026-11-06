import "server-only";
import { db } from "../db";

// WhatsApp Cloud API. Nothing is sent, and nothing pretends to be, until the Meta keys are in the environment.
export type WaConfig = { token: string; phoneNumberId: string; base: string };

export function waConfig(): WaConfig | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  const base = (process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com").replace(/\/$/, "");
  return { token, phoneNumberId, base: `${base}/${process.env.WHATSAPP_API_VERSION || "v27.0"}` };
}

export class WaSendError extends Error {
  /** retryable: worth trying again later (Meta down, rate limit), as opposed to a bad template or number. */
  constructor(message: string, public retryable: boolean) {
    super(message);
  }
}

async function post(config: WaConfig, to: string, body: object) {
  let res: Response;
  try {
    res = await fetch(`${config.base}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...body }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new WaSendError("تعذر الاتصال بواتساب.", true);
  }
  const json = (await res.json().catch(() => null)) as { messages?: { id?: string }[]; error?: { message?: string; code?: number } } | null;
  const wamid = json?.messages?.[0]?.id;
  if (!res.ok || !wamid) {
    throw new WaSendError(`${json?.error?.code ?? res.status}: ${json?.error?.message ?? "خطأ من واتساب"}`.slice(0, 300), res.status >= 500 || res.status === 429);
  }
  return wamid;
}

/** Finds or opens the conversation, then records the sent message with Meta's id so status updates can find it. */
async function record(phone: string, data: { wamid: string; type: string; body: string; templateName?: string; actor: string; name?: string | null }) {
  const now = new Date();
  const preview = data.body.slice(0, 120);
  const conversation = await db.waConversation.upsert({
    where: { phone },
    create: { phone, name: data.name ?? null, lastMessageAt: now, lastPreview: preview },
    update: { lastMessageAt: now, lastPreview: preview },
  });
  return db.waMessage.create({
    data: { conversationId: conversation.id, wamid: data.wamid, direction: "OUT", type: data.type, body: data.body, templateName: data.templateName, status: "sent", actor: data.actor },
  });
}

export async function sendWaText(phone: string, text: string, actor: string) {
  const config = waConfig();
  if (!config) throw new WaSendError("واتساب غير مربوط بعد.", false);
  const wamid = await post(config, phone, { type: "text", text: { preview_url: false, body: text } });
  return record(phone, { wamid, type: "text", body: text, actor });
}

export async function sendWaTemplate(phone: string, t: { name: string; language: string; params: string[] }, actor: string, customerName?: string | null) {
  const config = waConfig();
  if (!config) throw new WaSendError("واتساب غير مربوط بعد.", false);
  const wamid = await post(config, phone, {
    type: "template",
    template: {
      name: t.name,
      language: { code: t.language },
      ...(t.params.length ? { components: [{ type: "body", parameters: t.params.map((text) => ({ type: "text", text })) }] } : {}),
    },
  });
  return record(phone, { wamid, type: "template", body: t.params.length ? `${t.name}: ${t.params.join(" · ")}` : t.name, templateName: t.name, actor, name: customerName });
}
