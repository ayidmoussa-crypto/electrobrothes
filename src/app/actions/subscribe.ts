"use server";

import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { clientIp, hit } from "@/lib/guard";
import { normalizeSubscriberEmail } from "@/lib/subscriber-email";

export type SubscribeState = { status?: "ok" | "invalid" | "busy" };

export async function subscribe(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  // Honeypot: hidden from people, filled by bots. Answers like a success so they learn nothing.
  if (formData.get("website")) return { status: "ok" };

  const email = normalizeSubscriberEmail(formData.get("email"));
  if (!email) return { status: "invalid" };

  if ((await hit(`subscribe:ip:${await clientIp()}`, 3600)) > 10) return { status: "busy" };

  const raw = formData.get("locale");
  const locale = routing.locales.find((l) => l === raw) ?? routing.defaultLocale;
  // An address already on the list answers the same way, so the box cannot reveal who has signed up.
  await db.emailSubscriber.upsert({ where: { email }, create: { email, locale }, update: {} });
  revalidatePath("/admin/customers");
  return { status: "ok" };
}
