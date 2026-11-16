"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { aiOfferIdeas } from "@/app/actions/admin-campaign-ai";
import { buttonClass } from "@/components/ui/button";
import { AiButton } from "./AiButton";
import { useAdminTr } from "./AdminLang";
import { Panel } from "./ui";

type Idea = { productId: string; name: string; reason: string; titleAr: string; sublineAr: string; style: string };

/** "اقترح عروض جديدة": three products worth an offer, from stock and sales. Each opens a pre-filled new offer. */
export function OfferIdeas() {
  const { tr } = useAdminTr();
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Panel title={tr("أفكار عروض جديدة", "New offer ideas")} className="mb-6">
      <AiButton
        pending={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await aiOfferIdeas();
            if (r.ok) setIdeas(r.ideas);
            else setError(r.message);
          })
        }
      >
        {tr("اقترح عليا عروض جديدة", "Suggest new offers")}
      </AiButton>
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      {ideas ? (
        ideas.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {ideas.map((i) => (
              <li key={i.productId} className="flex flex-col gap-1.5 rounded-xl border border-warm-200 bg-warm-50 p-3">
                <b className="text-ink">{i.name}</b>
                <span className="text-sm text-warm-700">{i.reason}</span>
                <span className="text-sm text-warm-600">
                  «{i.titleAr}» — {i.sublineAr}
                </span>
                <Link
                  href={`/admin/campaigns/new?${new URLSearchParams({ product: i.productId, title: i.titleAr, subline: i.sublineAr, style: i.style })}`}
                  className={buttonClass({ variant: "outline", className: "mt-1 self-start" })}
                >
                  {tr("إنشاء هاد العرض", "Create this offer")}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-warm-600">{tr("ما لقى حتى فكرة دابا.", "No idea for now.")}</p>
        )
      ) : null}
    </Panel>
  );
}
