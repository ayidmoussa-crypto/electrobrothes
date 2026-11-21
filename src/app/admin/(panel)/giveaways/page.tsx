import { Gift, Plus, Radio, Trophy, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminLocale } from "@/lib/admin-tr";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { giveawayPhase, publicName, type GiveawayPhase } from "@/lib/giveaway-rules";
import { TIME_ZONE } from "@/lib/time";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("السحوبات", "Giveaways");

const PHASE: Record<GiveawayPhase, { label: [string, string]; tone: BadgeTone }> = {
  open: { label: ["التسجيل مفتوح", "Entries open"], tone: "success" },
  closed: { label: ["كيتسنى السحب", "Waiting for the draw"], tone: "accent" },
  drawn: { label: ["تسحب", "Drawn"], tone: "neutral" },
};

export default async function GiveawaysAdminPage() {
  const [, { tr, lang, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const date = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const giveaways = await db.giveaway.findMany({
    orderBy: [{ drawnAt: { sort: "asc", nulls: "first" } }, { drawAt: "desc" }],
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      image: true,
      drawAt: true,
      drawnAt: true,
      isPublished: true,
      product: { select: { images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } } },
      _count: { select: { entries: true } },
      entries: { where: { winnerRank: 1 }, select: { firstName: true, lastName: true } },
    },
  });

  return (
    <>
      <PageHeader
        title={tr("السحوبات", "Giveaways")}
        description={tr("الناس كيشاركو من الموقع بالاسم والرقم، ونتا كتسحب الرابح مباشرة قدام الناس.", "People enter on the shop with their name and number; you draw the winner live.")}
        actions={
          <Link href="/admin/giveaways/new" className={buttonClass()}>
            <Plus className="size-4" aria-hidden="true" />
            {tr("سحب جديد", "New giveaway")}
          </Link>
        }
      />

      {giveaways.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {giveaways.map((g) => {
            const phase = giveawayPhase(g);
            const img = g.image ?? g.product?.images[0]?.url;
            const winner = g.entries[0];
            return (
              <li key={g.id} className="admin-card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-ink">
                    {img ? <Image src={img} alt="" fill sizes="64px" unoptimized={img.endsWith(".svg")} className="object-contain p-1.5" /> : <Gift className="m-auto mt-4 size-8 text-yellow-500" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/giveaways/${g.id}`} className="font-bold text-ink underline-offset-4 hover:underline">
                      {ar ? g.titleAr : g.titleEn}
                    </Link>
                    <p className="text-sm text-warm-600">{date.format(g.drawAt)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={PHASE[phase].tone}>{tr(...PHASE[phase].label)}</Badge>
                      {g.isPublished ? null : <Badge>{tr("مخبي", "Hidden")}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-warm-200/70 pt-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-warm-800">
                    <Users className="size-4" aria-hidden="true" />
                    {tr(`${g._count.entries} مشارك`, `${g._count.entries} entries`)}
                    {winner ? (
                      <>
                        <Trophy className="ms-2 size-4 text-yellow-700" aria-hidden="true" />
                        <b>{publicName(winner.firstName, winner.lastName)}</b>
                      </>
                    ) : null}
                  </span>
                  {phase !== "open" || g._count.entries ? (
                    <a href={`/admin/live/${g.id}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "dark" })}>
                      <Radio className="size-4" aria-hidden="true" />
                      {tr("شاشة السحب", "Draw screen")}
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Gift className="size-10 text-warm-400" aria-hidden="true" />
            <p className="font-semibold text-ink">{tr("مازال ما درتي حتى سحب.", "No giveaways yet.")}</p>
            <p className="max-w-md text-sm text-warm-600">
              {tr(
                "دير سحب على منتج، وحط الرابط ديالو فإنستغرام وتيك توك. الناس كيشاركو من الموقع، والسحب كيبان فالصفحة الرئيسية حتى للوقت ديالو.",
                "Create a giveaway for a product and share its link on Instagram and TikTok. People enter on the shop, and it shows on the home page until the draw.",
              )}
            </p>
            <Link href="/admin/giveaways/new" className={buttonClass()}>
              <Plus className="size-4" aria-hidden="true" />
              {tr("دير أول سحب", "Create the first giveaway")}
            </Link>
          </div>
        </Panel>
      )}
    </>
  );
}
