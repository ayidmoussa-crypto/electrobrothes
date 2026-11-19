import { cookies } from "next/headers";
import { tr as pick, type AdminLang, type Tr } from "./admin-tr";

export type { AdminLang, Tr } from "./admin-tr";
export const ADMIN_LANG_COOKIE = "eb_admin_lang";

export const ADMIN_THEME_COOKIE = "eb_admin_theme";
export type AdminTheme = "light" | "dark";

/** Normal (white) or night mode for this browser. Normal is the default. */
export async function adminTheme(): Promise<AdminTheme> {
  return (await cookies()).get(ADMIN_THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}

/** The panel's language for this browser. Arabic is the default. */
export async function adminLang(): Promise<AdminLang> {
  return (await cookies()).get(ADMIN_LANG_COOKIE)?.value === "en" ? "en" : "ar";
}

/** The panel's language and a picker that takes each text in both languages: tr("الطلبات", "Orders"). */
export async function adminTr(): Promise<{ lang: AdminLang; ar: boolean; tr: Tr }> {
  const lang = await adminLang();
  return { lang, ar: lang === "ar", tr: pick(lang) };
}
