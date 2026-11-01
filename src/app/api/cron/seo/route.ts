import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { runSeoJob, NIGHTLY_LIMIT } from "@/lib/seo-content/job";

// The nightly SEO job. Called by Vercel Cron (vercel.json) or a crontab line with the shared secret.
const digest = (s: string) => createHash("sha256").update(s).digest();

// The job stops itself at four minutes; this gives it room to finish cleanly on Vercel.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const result = await runSeoJob({ trigger: "nightly", limit: NIGHTLY_LIMIT, origin: request.nextUrl.origin, actor: "seo-nightly" });
  if (!result.alreadyRunning && result.slugs.length) {
    revalidateTag("products", { expire: 0 });
    for (const slug of result.slugs) revalidateTag(`product:${slug}`, { expire: 0 });
    revalidatePath("/admin/products");
  }
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
