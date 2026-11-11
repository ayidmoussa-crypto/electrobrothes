import { z } from "zod";
import { normalizeMoroccanPhone } from "./phone";

// Pure giveaway rules shared by the shop, the dashboard and the live draw screen (no database here).

export type GiveawayPhase = "open" | "closed" | "drawn";

/** Open until the draw time; closed (waiting for the live) after it; drawn once the owner has drawn. */
export function giveawayPhase(g: { drawAt: Date; drawnAt: Date | null }, now = Date.now()): GiveawayPhase {
  if (g.drawnAt) return "drawn";
  return now < g.drawAt.getTime() ? "open" : "closed";
}

// Letters of any script, spaces, apostrophes and hyphens: "Aït-Ali", "عبد الله", "O'Neil".
const NAME = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;
const name = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s+/g, " "))
  .pipe(z.string().min(2, "short").max(40, "long").regex(NAME, "letters"));

export const entryInput = z.object({
  firstName: name,
  lastName: name,
  phone: z
    .string()
    .max(30)
    .transform((s, ctx) => {
      const phone = normalizeMoroccanPhone(s);
      if (!phone) ctx.addIssue({ code: "custom", message: "phone" });
      return phone ?? "";
    }),
  rules: z.literal("on", { message: "rules" }),
  marketing: z.preprocess((v) => v === "on", z.boolean()),
});

/** How a person is shown in public and on the live: "Ayoub M." — never the full surname. */
export function publicName(firstName: string, lastName: string) {
  const first = firstName.trim().split(/\s+/)[0] ?? "";
  const initial = [...lastName.trim()][0] ?? "";
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

/** "+212612345678" → "06 •• •• •• 78": the winner recognises the end of their number, nobody else can call it. */
export function maskPhone(e164: string) {
  return `0${e164.slice(4, 5)} •• •• •• ${e164.slice(-2)}`;
}

/** Uniform pick among the entries not drawn yet; `random(n)` returns an integer in [0, n). */
export function pickWinner<T>(pool: T[], random: (n: number) => number): T | null {
  if (!pool.length) return null;
  const i = random(pool.length);
  if (!Number.isInteger(i) || i < 0 || i >= pool.length) throw new Error("random out of range");
  return pool[i];
}

/**
 * Names flicked through before the winner lands: random names from the entries, ending on the winner.
 * With few entries the names repeat; with none but the winner, the reel is only the winner.
 */
export function drawReel(names: string[], winner: string, length = 40, random: () => number = Math.random) {
  const others = names.filter((n) => n !== winner);
  const reel: string[] = [];
  for (let i = 0; i < length - 1 && others.length; i++) {
    let next = others[Math.floor(random() * others.length)];
    // Avoid the same name twice in a row when there is a choice.
    if (next === reel.at(-1) && others.length > 1) next = others[(others.indexOf(next) + 1) % others.length];
    reel.push(next);
  }
  reel.push(winner);
  return reel;
}

/** Slug from the English title, with the month so yearly giveaways do not collide. */
export function giveawaySlug(title: string, drawAt: Date) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${base || "giveaway"}-${drawAt.toISOString().slice(0, 7)}`;
}
