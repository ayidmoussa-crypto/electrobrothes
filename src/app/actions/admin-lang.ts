"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { ADMIN_LANG_COOKIE } from "@/lib/admin-lang";

/** The dashboard's language, kept a year in this browser. */
export async function setAdminLang(formData: FormData) {
  await requireAdmin();
  const lang = formData.get("lang") === "en" ? "en" : "ar";
  (await cookies()).set(ADMIN_LANG_COOKIE, lang, { path: "/admin", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/admin");
}
