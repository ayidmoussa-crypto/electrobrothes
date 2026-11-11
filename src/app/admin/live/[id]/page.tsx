import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveDraw } from "@/components/admin/LiveDraw";
import { requireAdmin } from "@/lib/admin";
import { adminLocale } from "@/lib/admin-tr";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { maskPhone, publicName } from "@/lib/giveaway-rules";
import { formatMAD } from "@/lib/money";
import { TIME_ZONE } from "@/lib/time";

export const metadata: Metadata = { title: "Live" };

// Outside the panel layout on purpose: nothing but the stage is on screen during the live.
async function Stage({ params }: { params: Promise<{ id: string }> }) {
  const [, { lang, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const { id } = await params;
  const g = await db.giveaway.findUnique({
    where: { id },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      prizeAr: true,
      prizeEn: true,
      prizeValue: true,
      image: true,
      drawAt: true,
      product: { select: { images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } } },
      _count: { select: { entries: true } },
    },
  });
  if (!g) notFound();
  const [recent, winners] = await Promise.all([
    db.giveawayEntry.findMany({ where: { giveawayId: id }, orderBy: { createdAt: "desc" }, take: 40, select: { firstName: true, lastName: true } }),
    db.giveawayEntry.findMany({ where: { giveawayId: id, winnerRank: { not: null } }, orderBy: { winnerRank: "asc" }, select: { firstName: true, lastName: true, phone: true, winnerRank: true } }),
  ]);
  const date = new Intl.DateTimeFormat(adminLocale(lang), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

  return (
    <LiveDraw
      id={g.id}
      lang={lang}
      title={ar ? g.titleAr : g.titleEn}
      prize={ar ? g.prizeAr : g.prizeEn}
      worth={g.prizeValue ? (ar ? `قيمتها ${formatMAD(g.prizeValue, "ar")}` : `Worth ${formatMAD(g.prizeValue, "en")}`) : null}
      image={g.image ?? g.product?.images[0]?.url ?? null}
      drawAt={g.drawAt.toISOString()}
      drawLabel={date.format(g.drawAt)}
      entries={g._count.entries}
      recentNames={recent.map((e) => publicName(e.firstName, e.lastName))}
      winners={winners.map((w) => ({ name: publicName(w.firstName, w.lastName), phone: maskPhone(w.phone), rank: w.winnerRank! }))}
    />
  );
}

export default function LiveDrawPage({ params }: PageProps<"/admin/live/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <Stage params={params} />
    </Suspense>
  );
}
