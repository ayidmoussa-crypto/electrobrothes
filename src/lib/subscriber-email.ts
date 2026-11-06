import { z } from "zod";

const schema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** The stored form of an email (trimmed, lower case), or null when it is not one. */
export function normalizeSubscriberEmail(raw: unknown): string | null {
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
