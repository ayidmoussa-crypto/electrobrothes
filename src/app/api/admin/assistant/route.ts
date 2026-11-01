import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin";
import { REPLY, runAssistant, type IncomingMessage } from "@/lib/assistant/run";
import { sniffImage } from "@/lib/assistant/rules";
import { usageSummary } from "@/lib/assistant/usage";
import { hit } from "@/lib/guard";

// The admin assistant's only door to Claude. The API key stays here on the server.

const MAX_BODY_CHARS = 12_000_000;
const MAX_MESSAGES = 20;
const MAX_REQUESTS_PER_MINUTE = 20;

const body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(4000),
        images: z.array(z.string().min(16).max(5_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/)).max(4).optional(),
        closed: z.boolean().optional(),
        auto: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(60),
});

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  if (!(await getAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await usageSummary(), { headers: noStore });
}

export async function POST(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Route handlers do not get the origin check Server Actions have.
  const origin = request.headers.get("origin");
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")];
  if (!origin || !hosts.includes(new URL(origin).host)) return Response.json({ error: "forbidden" }, { status: 403 });

  if ((await hit(`assistant:${admin.id}`, 60)) > MAX_REQUESTS_PER_MINUTE) {
    return Response.json({ error: "بزاف ديال الطلبات فدقيقة. تسنى شوية." }, { status: 429 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: REPLY.notConfigured }, { status: 503 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return Response.json({ error: "الصور كبار بزاف." }, { status: 413 });
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  if (!parsed.success) return Response.json({ error: "طلب غير صالح." }, { status: 400 });

  const history: IncomingMessage[] = [];
  for (const m of parsed.data.messages.slice(-MAX_MESSAGES)) {
    const images = [];
    for (const data of m.images ?? []) {
      const mediaType = sniffImage(data);
      if (!mediaType) return Response.json({ error: "نوع الصورة ما مقبولش: استعمل JPG ولا PNG ولا WebP." }, { status: 415 });
      images.push({ mediaType, data });
    }
    history.push({ role: m.role, text: m.text, images: m.role === "user" ? images : undefined, closed: m.closed, auto: m.auto });
  }
  // The API needs the conversation to open with the admin, even after trimming.
  while (history[0]?.role === "assistant") history.shift();
  if (!history.length) return Response.json({ error: "طلب غير صالح." }, { status: 400 });

  try {
    return Response.json(await runAssistant(history, admin.email, request.nextUrl.origin), { headers: noStore });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "مفتاح Claude API ما خدامش. تحقق من ANTHROPIC_API_KEY." }, { status: 502 });
    if (e instanceof Anthropic.PermissionDeniedError) return Response.json({ error: "هاد المفتاح ما عندوش الحق يستعمل هاد النموذج." }, { status: 502 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "Claude مشغول دابا. عاود جرب من بعد شوية." }, { status: 503 });
    if (e instanceof Anthropic.APIConnectionError) return Response.json({ error: "ما قدرناش نتصلو بـ Claude. عاود جرب." }, { status: 503 });
    if (e instanceof Anthropic.APIError) {
      console.error("assistant: Claude API error", e.status, e.message);
      return Response.json({ error: "وقع مشكل مع Claude. عاود جرب." }, { status: 502 });
    }
    throw e;
  }
}
