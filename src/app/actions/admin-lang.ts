"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin";
import { ADMIN_LANG_COOKIE, ADMIN_THEME_COOKIE } from "@/lib/admin-lang";

/** Normal or night mode, kept a year in this browser. */
export async function setAdminTheme(formData: FormData) {
  await requireStaff();
  const theme = formData.get("theme") === "dark" ? "dark" : "light";
  // Readable by the page (not secret): the loading screen uses it to start dark too.
  (await cookies()).set(ADMIN_THEME_COOKIE, theme, { path: "/admin", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/admin", "layout");
}

/** The panel's language, kept a year in this browser; every admin page re-renders with it. */
export async function setAdminLang(formData: FormData) {
  await requireStaff();
  const lang = formData.get("lang") === "en" ? "en" : "ar";
  (await cookies()).set(ADMIN_LANG_COOKIE, lang, { path: "/admin", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/admin", "layout");
}
