"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/** Phones show a search icon instead of the full box; this tracks whether the box is unfolded. */
const SearchToggle = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });
export const useSearchToggle = () => useContext(SearchToggle);

/**
 * Sticky floating header in pale frosted glass: the page shows through it, blurred, and tints it as it
 * scrolls under. Once scrolled it gains a soft shadow.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  // Remembers the page it was opened on, so a search that lands on a new page folds the box away again.
  const [searchOpenOn, setSearchOpenOn] = useState<string | null>(null);
  const pathname = usePathname();
  const searchOpen = searchOpenOn === pathname;
  const setSearchOpen = (open: boolean) => setSearchOpenOn(open ? pathname : null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The phone keyboard can pan the visible area past a sticky bar: keep the bar on screen while searching.
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const view = window.visualViewport;
    const el = header.current;
    if (!searchOpen || !view || !el) return;
    const follow = () => {
      el.style.transform = view.offsetTop ? `translateY(${view.offsetTop}px)` : "";
    };
    follow();
    view.addEventListener("resize", follow);
    view.addEventListener("scroll", follow);
    return () => {
      view.removeEventListener("resize", follow);
      view.removeEventListener("scroll", follow);
      el.style.transform = "";
    };
  }, [searchOpen]);

  return (
    <SearchToggle.Provider value={{ open: searchOpen, setOpen: setSearchOpen }}>
      <header
        ref={header}
        data-scrolled={scrolled}
        data-search={searchOpen ? "open" : "closed"}
        // A floating bar: it never touches the screen edges, at rest or while scrolling.
        className={`group/header sticky top-3 z-30 mx-3 mt-3 rounded-3xl border border-(color:--glass-header-border) bg-(color:--glass-header-bg) text-ink backdrop-blur-xl backdrop-saturate-150 md:mx-4 ${scrolled ? "shadow-lg shadow-ink/10" : ""}`}
      >
        {children}
      </header>
    </SearchToggle.Provider>
  );
}
