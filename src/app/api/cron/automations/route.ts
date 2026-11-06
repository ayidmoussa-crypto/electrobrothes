import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { runDueAutomations } from "@/lib/automations";

// Sends automation messages whose delay has ended. Called by Vercel Cron or a crontab line with the shared secret.
const digest = (s: string) => createHash("sha256").update(s).digest();

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await runDueAutomations(), { headers: { "Cache-Control": "no-store" } });
}
