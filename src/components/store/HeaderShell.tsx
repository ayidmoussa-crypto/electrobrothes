"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/** Phones show a search icon instead of the full box; this tracks whether the box is unfolded. */
const SearchToggle = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });
export const useSearchToggle = () => useContext(SearchToggle);

/**
 * Sticky header in solid ink. It stays opaque while scrolling (a see-through header flashed the
 * white page through as it came back); once scrolled it only gains a soft shadow.
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

  return (
    <SearchToggle.Provider value={{ open: searchOpen, setOpen: setSearchOpen }}>
      <header
        data-scrolled={scrolled}
        data-search={searchOpen ? "open" : "closed"}
        // Bottom corners rounded; the sides stay straight.
        className={`group/header sticky top-0 z-30 rounded-b-3xl bg-ink text-white ${scrolled ? "shadow-lg shadow-ink/25" : ""}`}
      >
        {children}
      </header>
    </SearchToggle.Provider>
  );
}
