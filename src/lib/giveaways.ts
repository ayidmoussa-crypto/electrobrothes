import "server-only";
import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { giveawayPhase, publicName, type GiveawayPhase } from "./giveaway-rules";

// The shop's view of a giveaway: never the entrants' numbers, only the winners' public names.

/** A drawn giveaway keeps its winners on the home page this long, then the section goes away. */
const SHOW_WINNERS_DAYS = 7;

export type PublicGiveaway = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  prizeAr: string;
  prizeEn: string;
  detailsAr: string | null;
  detailsEn: string | null;
  image: string | null;
  productSlug: string | null;
  prizeValue: number | null;
  drawAt: string;
  liveUrl: string | null;
  phase: GiveawayPhase;
  entries: number;
  winners: { name: string; rank: number }[];
};

const select = {
  id: true,
  slug: true,
  titleAr: true,
  titleEn: true,
  prizeAr: true,
  prizeEn: true,
  detailsAr: true,
  detailsEn: true,
  image: true,
  prizeValue: true,
  drawAt: true,
  drawnAt: true,
  liveUrl: true,
  product: { select: { slug: true, isActive: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } } },
  _count: { select: { entries: true } },
  entries: { where: { winnerRank: { not: null } }, orderBy: { winnerRank: "asc" }, select: { firstName: true, lastName: true, winnerRank: true } },
} satisfies Prisma.GiveawaySelect;

type Row = Prisma.GiveawayGetPayload<{ select: typeof select }>;

function toPublic(g: Row): PublicGiveaway {
  const product = g.product?.isActive ? g.product : null;
  return {
    id: g.id,
    slug: g.slug,
    titleAr: g.titleAr,
    titleEn: g.titleEn,
    prizeAr: g.prizeAr,
    prizeEn: g.prizeEn,
    detailsAr: g.detailsAr,
    detailsEn: g.detailsEn,
    image: g.image ?? g.product?.images[0]?.url ?? null,
    productSlug: product?.slug ?? null,
    prizeValue: g.prizeValue,
    drawAt: g.drawAt.toISOString(),
    liveUrl: g.liveUrl,
    phase: giveawayPhase(g),
    entries: g._count.entries,
    winners: g.entries.map((e) => ({ name: publicName(e.firstName, e.lastName), rank: e.winnerRank! })),
  };
}

/** The giveaway the home page shows: the next one still to draw, else one drawn in the last week. */
export async function getShowcaseGiveaway(): Promise<PublicGiveaway | null> {
  await connection();
  const next = await db.giveaway.findFirst({ where: { isPublished: true, drawnAt: null }, orderBy: { drawAt: "asc" }, select });
  if (next) return toPublic(next);
  const since = new Date(Date.now() - SHOW_WINNERS_DAYS * 86_400_000);
  const recent = await db.giveaway.findFirst({ where: { isPublished: true, drawnAt: { gte: since } }, orderBy: { drawnAt: "desc" }, select });
  return recent ? toPublic(recent) : null;
}

export async function getGiveawayBySlug(slug: string): Promise<PublicGiveaway | null> {
  await connection();
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const g = await db.giveaway.findFirst({ where: { slug, isPublished: true }, select });
  return g ? toPublic(g) : null;
}
