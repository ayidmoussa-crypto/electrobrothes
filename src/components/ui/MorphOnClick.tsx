"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Put inside the page's <ViewTransition>. Back and forward show a page Next kept hidden, which React does not count
 * as a change, so no transition would run: this mark changes with the address, and makes it one.
 */
export function RouteMark() {
  return <span hidden data-route={usePathname()} />;
}

/**
 * When a link is clicked, names the picture of the card it belongs to (the Morph `source` nearest to the link),
 * so that picture flies into the page the link opens. The name stays after the click, so the back button flies it
 * home again; the next click moves it to the new card.
 */
export function MorphOnClick() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link) return;
      // The card: the closest box around the link holding exactly one marked picture (a whole grid holds many).
      let box: Element | null = link;
      let source: HTMLElement | null = null;
      for (let i = 0; box && i < 6 && !source; i++, box = box.parentElement) {
        const found = box.querySelectorAll<HTMLElement>("[data-morph]");
        if (found.length > 1) return;
        if (found.length === 1) source = found[0];
      }
      if (!source) return;
      for (const el of document.querySelectorAll<HTMLElement>("[data-morph]")) {
        el.style.viewTransitionName = "";
      }
      source.style.viewTransitionName = source.dataset.morph!;
      source.style.setProperty("view-transition-class", "morph");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
