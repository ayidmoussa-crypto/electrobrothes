import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { WEAK_SCORE } from "./rules";
import { dailyHistory, rescoreAll, seoOverview } from "./score";
import { generateSuggestions, SeoBudgetError } from "./service";

export const NIGHTLY_LIMIT = 20;
// A serverless function is cut off around five minutes: finish cleanly, the next night continues.
const DEADLINE_MS = 4 * 60 * 1000;
const STALE_RUN_MS = 15 * 60 * 1000;
const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Goes through the weakest visible products that have nothing waiting, and generates their content.
 * The monthly ceiling is checked before every product. Returns the storefront slugs to refresh.
 */
export async function runSeoJob({ trigger, limit, origin, actor }: { trigger: "nightly" | "manual"; limit: number; origin: string; actor: string }) {
  const running = await db.seoRun.findFirst({ where: { status: "RUNNING", startedAt: { gte: new Date(Date.now() - STALE_RUN_MS) } }, select: { id: true } });
  if (running) return { alreadyRunning: true as const };

  const run = await db.seoRun.create({ data: { trigger, actor }, select: { id: true } });
  const started = Date.now();
  const totals = { examined: 0, generated: 0, failed: 0, suggestions: 0, autoApplied: 0 };
  const slugs = new Set<string>();
  let stoppedBy: string | null = null;

  try {
    await rescoreAll();
    // A product generated recently is left alone: paying again every night would not improve it.
    const where = {
      isActive: true,
      seoScore: { lt: WEAK_SCORE },
      seoSuggestions: { none: { OR: [{ status: "PENDING" as const }, { createdAt: { gte: new Date(Date.now() - RETRY_AFTER_MS) } }] } },
    };
    totals.examined = await db.product.count({ where: { isActive: true } });
    const weak = await db.product.findMany({ where, orderBy: { seoScore: "asc" }, take: limit, select: { id: true } });

    for (const { id } of weak) {
      if (Date.now() - started > DEADLINE_MS) {
        stoppedBy = "deadline";
        break;
      }
      try {
        const result = await generateSuggestions(id, { actor, origin, nightly: true });
        totals.generated++;
        totals.suggestions += result.created.length;
        totals.autoApplied += result.autoApplied;
        for (const slug of result.slugs) slugs.add(slug);
      } catch (e) {
        if (e instanceof SeoBudgetError) {
          stoppedBy = "budget";
          break;
        }
        // A bad key fails every product: stop instead of retrying the whole list.
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
          stoppedBy = "api_key";
          break;
        }
        totals.failed++;
        console.error("seo job: product failed", id, e instanceof Error ? e.message : e);
      }
    }
    await dailyHistory(await seoOverview());
    await db.seoRun.update({ where: { id: run.id }, data: { ...totals, stoppedBy, status: "DONE", finishedAt: new Date() } });
  } catch (e) {
    await db.seoRun.update({ where: { id: run.id }, data: { ...totals, stoppedBy, status: "FAILED", finishedAt: new Date() } });
    throw e;
  }
  return { alreadyRunning: false as const, ...totals, stoppedBy, slugs: [...slugs] };
}
