import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { erEnvOf, syncExpressRelais } from "@/lib/carrier/expressrelais-send";
import { db } from "@/lib/db";

// Pulls parcel steps from Express Relais for every connected company. Called every few minutes by Vercel Cron
// or any scheduler, with the shared secret: Authorization: Bearer <CRON_SECRET>.
const digest = (s: string) => createHash("sha256").update(s).digest();

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const carriers = (await db.carrier.findMany({ where: { isActive: true }, select: { id: true, name: true, apiBaseUrl: true, credentials: true } })).filter((c) => erEnvOf(c.apiBaseUrl));
  const results: Record<string, unknown> = {};
  for (const c of carriers) {
    const r = await syncExpressRelais(c);
    results[c.name] = r;
    await db.carrier.update({ where: { id: c.id }, data: { lastEventAt: r.updated ? new Date() : undefined, lastError: r.problems[0]?.slice(0, 300) ?? null } });
  }
  revalidatePath("/admin/orders");
  return Response.json(results, { headers: { "Cache-Control": "no-store" } });
}
