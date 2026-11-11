"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { drawReel, giveawaySlug, maskPhone, pickWinner, publicName } from "@/lib/giveaway-rules";
import { moroccanDate } from "@/lib/time";

type State = { ok?: boolean; message?: string };

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((s) => s || null);
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((s) => s || null)
  .refine((s) => s === null || /^https:\/\/\S+$/.test(s), "url");

const giveawayInput = z.object({
  id: z.string().max(40).optional().transform((v) => v || undefined),
  titleAr: z.string().trim().min(3).max(120),
  titleEn: z.string().trim().min(3).max(120),
  prizeAr: z.string().trim().min(2).max(120),
  prizeEn: z.string().trim().min(2).max(120),
  detailsAr: optionalText(1500),
  detailsEn: optionalText(1500),
  image: httpsUrl,
  liveUrl: httpsUrl,
  productId: z.string().max(40).optional().transform((v) => v || null),
  prizeValue: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(1).max(1_000_000).nullable()),
  drawAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "date").transform((s) => moroccanDate(`${s}:00`)),
  isPublished: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

function refresh(id?: string) {
  revalidatePath("/admin/giveaways");
  if (id) revalidatePath(`/admin/giveaways/${id}`);
  // The home band and the giveaway page read the database at request time; this only clears router caches.
  revalidatePath("/", "layout");
}

export async function saveGiveaway(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const { tr } = await adminTr();
  const parsed = giveawayInput.safeParse(Object.fromEntries([...fd].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const msg: Record<string, string> = {
      image: tr("رابط الصورة خاصو يبدا بـ https://", "The image link must start with https://"),
      liveUrl: tr("رابط البث خاصو يبدا بـ https://", "The live link must start with https://"),
      drawAt: tr("اختار تاريخ ووقت السحب.", "Pick the draw date and time."),
      prizeValue: tr("القيمة خاصها تكون رقم بالدرهم.", "The value must be a number in MAD."),
    };
    return { ok: false, message: msg[field] ?? tr("عمّر العنوان والجائزة بالعربية والإنجليزية.", "Fill in the title and prize in Arabic and English.") };
  }
  const { id, ...data } = parsed.data;
  if (data.productId && !(await db.product.findUnique({ where: { id: data.productId }, select: { id: true } }))) {
    return { ok: false, message: tr("المنتج ما بقاش موجود.", "The product no longer exists.") };
  }

  if (id) {
    const current = await db.giveaway.findUnique({ where: { id }, select: { drawnAt: true, drawAt: true } });
    if (!current) return { ok: false, message: tr("ما لقيناش هاد السحب.", "Giveaway not found.") };
    // Once drawn, the date is history: moving it would reopen entries on paper.
    if (current.drawnAt && data.drawAt.getTime() !== current.drawAt.getTime()) {
      return { ok: false, message: tr("السحب تدار: ما يمكنش تبدل التاريخ ديالو.", "Already drawn: its date cannot change.") };
    }
    await db.giveaway.update({ where: { id }, data });
    refresh(id);
    return { ok: true, message: tr("تم الحفظ.", "Saved.") };
  }

  if (data.drawAt.getTime() < Date.now() + 10 * 60_000) {
    return { ok: false, message: tr("وقت السحب خاصو يكون فالمستقبل باش الناس يلحقو يشاركو.", "The draw time must be in the future so people can enter.") };
  }
  let created: { id: string } | null = null;
  for (let n = 0; n < 5 && !created; n++) {
    const slug = giveawaySlug(data.titleEn, data.drawAt) + (n ? `-${n + 1}` : "");
    try {
      created = await db.giveaway.create({ data: { ...data, slug }, select: { id: true } });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  if (!created) return { ok: false, message: tr("بدّل العنوان الإنجليزي شوية.", "Change the English title a little.") };
  refresh(created.id);
  redirect(`/admin/giveaways/${created.id}?saved=1`);
}

export async function deleteGiveaway(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const { tr } = await adminTr();
  const id = String(fd.get("id") ?? "").slice(0, 40);
  const g = await db.giveaway.delete({ where: { id }, select: { id: true } }).catch(() => null);
  if (!g) return { ok: false, message: tr("ما لقيناش هاد السحب.", "Giveaway not found.") };
  refresh();
  redirect("/admin/giveaways");
}

/** Removes a fake or doubtful entry before the draw; a drawn winner stays on record. */
export async function removeEntry(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id") ?? "").slice(0, 40);
  const e = await db.giveawayEntry.findUnique({ where: { id }, select: { giveawayId: true, winnerRank: true } });
  if (!e || e.winnerRank !== null) return;
  await db.giveawayEntry.delete({ where: { id } });
  refresh(e.giveawayId);
}

export type DrawResult =
  | { ok: true; winner: { name: string; phone: string; rank: number }; reel: string[]; left: number }
  | { ok: false; message: string };

/**
 * Draws the next winner (rank 1, then backups) with the system's cryptographic random source. The giveaway
 * row is locked for the draw, so two clicks can never give the same rank twice. The first draw closes entries.
 */
export async function drawWinner(giveawayId: string): Promise<DrawResult> {
  await requireAdmin();
  const { tr } = await adminTr();
  const id = z.string().min(1).max(40).safeParse(giveawayId);
  if (!id.success) return { ok: false, message: tr("طلب غير صالح.", "Invalid request.") };

  const result = await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Giveaway" WHERE "id" = ${id.data} FOR UPDATE`;
    if (!locked.length) return { error: tr("ما لقيناش هاد السحب.", "Giveaway not found.") };
    const pool = await tx.giveawayEntry.findMany({ where: { giveawayId: id.data, winnerRank: null }, select: { id: true, firstName: true, lastName: true, phone: true }, orderBy: { createdAt: "asc" } });
    const entry = pickWinner(pool, (n) => randomInt(n));
    if (!entry) return { error: tr("ما بقا حتى مشارك ما تسحبش.", "No entries left to draw.") };
    const last = await tx.giveawayEntry.aggregate({ where: { giveawayId: id.data }, _max: { winnerRank: true } });
    const rank = (last._max.winnerRank ?? 0) + 1;
    const now = new Date();
    await tx.giveawayEntry.update({ where: { id: entry.id }, data: { winnerRank: rank, drawnAt: now } });
    await tx.giveaway.updateMany({ where: { id: id.data, drawnAt: null }, data: { drawnAt: now } });
    return { entry, rank, names: pool.map((p) => publicName(p.firstName, p.lastName)), left: pool.length - 1 };
  });
  if ("error" in result) return { ok: false, message: result.error ?? "" };

  refresh(id.data);
  const name = publicName(result.entry.firstName, result.entry.lastName);
  return { ok: true, winner: { name, phone: maskPhone(result.entry.phone), rank: result.rank }, reel: drawReel(result.names, name, 46), left: result.left };
}
