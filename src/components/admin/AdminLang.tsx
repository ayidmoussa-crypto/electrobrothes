"use client";

import { createContext, useContext, type ReactNode } from "react";
import { tr, type AdminLang } from "@/lib/admin-tr";

const Lang = createContext<AdminLang>("ar");

/** Set once by the panel layout from the language cookie. */
export function AdminLangProvider({ lang, children }: { lang: AdminLang; children: ReactNode }) {
  return <Lang.Provider value={lang}>{children}</Lang.Provider>;
}

/** Client components' picker: const { tr } = useAdminTr(); tr("حفظ", "Save"). */
export function useAdminTr() {
  const lang = useContext(Lang);
  return { lang, ar: lang === "ar", tr: tr(lang) };
}
