"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { entryInput, giveawayPhase } from "@/lib/giveaway-rules";
import { clientIp, hit, verifyTurnstile } from "@/lib/guard";

export type EntryField = "firstName" | "lastName" | "phone" | "rules";

export type EntryState = {
  status?: "ok" | "invalid" | "closed" | "busy" | "captcha";
  fieldErrors?: Partial<Record<EntryField, string>>;
  values?: { firstName: string; lastName: string; phone: string };
};

/** One entry per Moroccan number and giveaway; free, no purchase. */
export async function enterGiveaway(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const raw = Object.fromEntries([...formData].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const values = { firstName: (raw.firstName ?? "").slice(0, 60), lastName: (raw.lastName ?? "").slice(0, 60), phone: (raw.phone ?? "").slice(0, 30) };
  // Honeypot: answers like a success so bots learn nothing.
  if (raw.website) return { status: "ok" };

  const parsed = entryInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: EntryState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as EntryField] ??= issue.message;
    return { status: "invalid", fieldErrors, values };
  }

  const giveaway = await db.giveaway.findFirst({ where: { id: String(raw.giveawayId ?? "").slice(0, 40), isPublished: true }, select: { id: true, slug: true, drawAt: true, drawnAt: true } });
  if (!giveaway || giveawayPhase(giveaway) !== "open") return { status: "closed", values };

  const ip = await clientIp();
  if ((await hit(`giveaway:ip:${ip}`, 3600)) > 8) return { status: "busy", values };
  if (!(await verifyTurnstile(raw["cf-turnstile-response"] ?? null, ip))) return { status: "captcha", values };

  const { firstName, lastName, phone, marketing } = parsed.data;
  // A number already in answers the same way, so the form cannot tell who has entered.
  await db.giveawayEntry.upsert({
    where: { giveawayId_phone: { giveawayId: giveaway.id, phone } },
    create: { giveawayId: giveaway.id, firstName, lastName, phone, marketing, ip: ip === "unknown" ? null : ip },
    update: {},
  });
  revalidatePath(`/admin/giveaways/${giveaway.id}`);
  return { status: "ok" };
}
