"use client";

import { useState, useTransition } from "react";
import { aiAnalyzeCampaigns } from "@/app/actions/admin-campaign-ai";
import { AiButton } from "./AiButton";
import { useAdminTr } from "./AdminLang";
import { Panel } from "./ui";

/** "حلل بالذكاء الاصطناعي": Claude reads the figures above and says what they show, in Darija. */
export function CampaignAnalysis() {
  const { tr } = useAdminTr();
  const [result, setResult] = useState<{ summary: string; points: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Panel title={tr("تحليل الذكاء الاصطناعي", "AI analysis")}>
      <AiButton
        pending={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await aiAnalyzeCampaigns();
            if (r.ok) setResult(r.analysis);
            else setError(r.message);
          })
        }
      >
        {tr("حلل النقرات والطلبات", "Analyse clicks and orders")}
      </AiButton>
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      {result ? (
        <div role="status" className="mt-4 flex flex-col gap-2">
          <p className="font-semibold text-ink">{result.summary}</p>
          {result.points.length ? (
            <ul className="ms-5 list-disc text-sm text-warm-800">
              {result.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-warm-500">{tr("كيعتمد غير على الأرقام اللي فوق.", "Based only on the figures above.")}</p>
        </div>
      ) : null}
    </Panel>
  );
}
