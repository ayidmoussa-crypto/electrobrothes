import { createHash, timingSafeEqual } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { storeInbound, storeStatus } from "@/lib/whatsapp/inbound";
import { parseWebhook, verifySignature } from "@/lib/whatsapp/rules";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Meta's one-time check when the webhook address is registered. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  const given = q.get("hub.verify_token") ?? "";
  if (expected && q.get("hub.mode") === "subscribe" && timingSafeEqual(digest(given), digest(expected))) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("not configured", { status: 503 });

  // The signature covers the exact bytes Meta sent, so the body is read as text before any parsing.
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), secret)) return new Response("invalid signature", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const { messages, statuses } = parseWebhook(payload);
  // Messages first: a status in the same call may be about one of them. A failure answers 500 so Meta retries,
  // and storing twice is harmless because every message is unique by its id.
  for (const m of messages) await storeInbound(m);
  for (const s of statuses) await storeStatus(s);

  // Any incoming traffic also moves along automation messages whose delay has ended.
  after(async () => {
    const { runDueAutomations } = await import("@/lib/automations");
    await runDueAutomations().catch((e) => console.error("[automations]", e));
  });
  return new Response("ok", { status: 200 });
}
