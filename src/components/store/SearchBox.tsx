"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatMAD } from "@/lib/money";
import { useSearchToggle } from "./HeaderShell";

const iconButton = "grid size-11 cursor-pointer place-items-center rounded-full transition-colors hover:bg-ink/5";

/** Phone-only search icon: unfolds the search box sideways, inside the header row. */
export function SearchToggleButton() {
  const t = useTranslations("header");
  const { open, setOpen } = useSearchToggle();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls="site-search-form"
      aria-label={open ? t("closeSearch") : t("openSearch")}
      className={`${iconButton} md:hidden`}
    >
      {open ? <X className="size-6" aria-hidden="true" /> : <Search className="size-6" aria-hidden="true" />}
    </button>
  );
}

type Suggestion ={ slug: string; nameAr: string; nameEn: string; brand: string; price: number; image: string | null };

/**
 * Header search: a plain GET form to /search (works without JS), enhanced with an
 * ARIA combobox of instant suggestions (debounced, keyboard navigable).
 */
export function SearchBox({ action }: { action: string }) {
  const t = useTranslations("header");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggle = useSearchToggle();

  // Unfolded from the phone search icon: put the cursor straight in the field.
  useEffect(() => {
    if (toggle.open) inputRef.current?.focus({ preventScroll: true });
  }, [toggle.open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items: Suggestion[] };
        setItems(data.items);
        setActive(-1);
        setOpen(true);
      } catch {
        // Aborted or offline: the form submit still works.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: PointerEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const showList = open && q.trim().length >= 2;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <form
      ref={boxRef}
      action={action}
      method="get"
      role="search"
      id="site-search-form"
      // Phones: folded to nothing beside the search icon, it grows sideways between the menu button and the
      // icons. Not positioned there, so the suggestions open at the full width of the header, not of this box.
      // Visible at once when opening (a hidden field cannot take the cursor), and only after folding when closing.
      className={`flex min-w-0 duration-300 max-md:order-1 md:relative md:mx-6 md:flex-1 ${toggle.open ? "transition-[flex-grow] max-md:flex-[1_1_0%]" : "transition-[flex-grow,visibility] max-md:invisible max-md:flex-[0_0_0%]"}`}
      onSubmit={(e) => {
        if (active >= 0 && items[active]) {
          e.preventDefault();
          setOpen(false);
          router.push(`/products/${items[active].slug}`);
        }
      }}
    >
      <label htmlFor="site-search" className="sr-only">
        {t("searchLabel")}
      </label>
      <input
        ref={inputRef}
        id="site-search"
        name="q"
        type="search"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value.trim().length < 2) setOpen(false);
        }}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !showList && toggle.open) toggle.setOpen(false);
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        placeholder={t("searchPlaceholder")}
        className="min-h-11 w-full min-w-0 rounded-s-lg border-0 bg-white px-4 text-base text-warm-800 text-ellipsis placeholder:text-warm-400 [&::-webkit-search-cancel-button]:appearance-none max-md:min-h-10 max-md:rounded-full max-md:px-3"
      />
      {/* Phones search from the keyboard's own key: the narrow field needs this button's width. */}
      <button type="submit" className={buttonClass({ className: "rounded-s-none max-md:hidden" })}>
        <Search className="size-5" aria-hidden="true" />
        {/* Icon only from xl, where the box shares its row with the categories and needs the width. */}
        <span className="sr-only md:not-sr-only xl:sr-only">{t("searchButton")}</span>
      </button>

      <div
        className={`animate-pop absolute inset-x-0 top-full z-40 mt-2 origin-top overflow-hidden rounded-xl border border-warm-200 bg-white text-warm-800 shadow-xl shadow-ink/10 ${showList ? "" : "hidden"}`}
      >
        <ul id={listId} role="listbox" aria-label={t("suggestions")}>
          {items.map((s, i) => (
            <li key={s.slug} id={optionId(i)} role="option" aria-selected={i === active}>
              <Link
                href={`/products/${s.slug}`}
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 ${i === active ? "bg-yellow-100" : "hover:bg-warm-50"}`}
              >
                <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-warm-50">
                  {s.image ? <Image src={s.image} alt="" fill sizes="48px" unoptimized={s.image.endsWith(".svg")} className="object-contain p-1" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{locale === "ar" ? s.nameAr : s.nameEn}</span>
                  <span className="block text-xs text-warm-500" dir="ltr">
                    {s.brand}
                  </span>
                </span>
                <span className="text-sm font-bold text-ink">{formatMAD(s.price, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {items.length ? (
          <button type="submit" className="block w-full border-t border-warm-200 px-3 py-3 text-start text-sm font-semibold text-ink hover:bg-warm-50">
            {t("seeAllResults", { q: q.trim() })}
          </button>
        ) : (
          <p className="px-3 py-3 text-sm text-warm-600">{t("noSuggestions")}</p>
        )}
      </div>
    </form>
  );
}
