"use client";

import { useLayoutEffect } from "react";

/** Keeps <html lang dir> in step with the panel's language (the root layout is shared and static, so it starts as Arabic). */
export function HtmlLang({ lang, dir }: { lang: string; dir: "rtl" | "ltr" }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dir;
  }, [lang, dir]);
  return null;
}
