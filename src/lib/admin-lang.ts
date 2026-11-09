import { cookies } from "next/headers";

export type AdminLang = "ar" | "en";
export const ADMIN_LANG_COOKIE = "eb_admin_lang";

/** The dashboard's language for this browser. Arabic is the default. */
export async function adminLang(): Promise<AdminLang> {
  return (await cookies()).get(ADMIN_LANG_COOKIE)?.value === "en" ? "en" : "ar";
}
