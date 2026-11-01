import "server-only";
import { db } from "@/lib/db";
import { budgetMonth, costMicros, type AssistantUsageView, type Tokens } from "./rules";

export async function usageSummary(): Promise<AssistantUsageView> {
  const [spent, settings] = await Promise.all([
    db.assistantUsage.aggregate({ where: { month: budgetMonth() }, _sum: { costMicros: true } }),
    db.settings.findUnique({ where: { id: 1 }, select: { assistantBudgetCents: true } }),
  ]);
  return { spentMicros: spent._sum.costMicros ?? 0, capCents: settings?.assistantBudgetCents ?? 500, configured: !!process.env.ANTHROPIC_API_KEY };
}

export async function recordUsage(model: string, tokens: Tokens, actor: string) {
  await db.assistantUsage.create({
    data: {
      month: budgetMonth(),
      model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cacheReadTokens: tokens.cacheRead ?? 0,
      cacheWriteTokens: tokens.cacheWrite ?? 0,
      costMicros: costMicros(model, tokens),
      actor,
    },
  });
}
