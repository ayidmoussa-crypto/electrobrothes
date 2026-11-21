"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { tr, type AdminLang } from "@/lib/admin-tr";

const Lang = createContext<AdminLang>("ar");

/** Set once by the panel layout from the language cookie. */
export function AdminLangProvider({ lang, children }: { lang: AdminLang; children: ReactNode }) {
  return <Lang.Provider value={lang}>{children}</Lang.Provider>;
}

/** Client components' picker: const { tr } = useAdminTr(); tr("حفظ", "Save"). */
export function useAdminTr() {
  const lang = useContext(Lang);
  // Memoised: effects list `tr` as a dependency, and a new function every render made them run again and again.
  return useMemo(() => ({ lang, ar: lang === "ar", tr: tr(lang) }), [lang]);
}
