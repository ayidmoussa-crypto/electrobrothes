import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { seoScore, WEAK_SCORE } from "./rules";
import { contentSelect, generateSuggestions, SeoBudgetError } from "./service";

export const NIGHTLY_LIMIT = 20;
// A serverless function is cut off around five minutes: finish cleanly, the next night continues.
const DEADLINE_MS = 4 * 60 * 1000;
const STALE_RUN_MS = 15 * 60 * 1000;

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
    const products = await db.product.findMany({
      where: { isActive: true, seoSuggestions: { none: { status: "PENDING" } } },
      select: { ...contentSelect, _count: { select: { specs: true, faqs: true } } },
    });
    totals.examined = products.length;
    const weak = products
      .map((p) => ({ id: p.id, score: seoScore({ ...p, specCount: p._count.specs, faqCount: p._count.faqs }).score }))
      .filter((p) => p.score < WEAK_SCORE)
      .sort((a, b) => a.score - b.score)
      .slice(0, limit);

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
    await db.seoRun.update({ where: { id: run.id }, data: { ...totals, stoppedBy, status: "DONE", finishedAt: new Date() } });
  } catch (e) {
    await db.seoRun.update({ where: { id: run.id }, data: { ...totals, stoppedBy, status: "FAILED", finishedAt: new Date() } });
    throw e;
  }
  return { alreadyRunning: false as const, ...totals, stoppedBy, slugs: [...slugs] };
}
