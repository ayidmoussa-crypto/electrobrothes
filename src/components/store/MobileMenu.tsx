"use client";

import {
  CircleHelp,
  GitCompareArrows,
  Languages,
  Menu,
  PackageSearch,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  type Variants,
} from "motion/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/navigation";

type Item = {
  href: string;
  label: string;
  image: string | null;
  count: number;
};

/** The pane drops from the header with a small spring; once open, its rows arrive one after the other. */
const PANE: Variants = {
  closed: { opacity: 0, y: -12, scale: 0.97, transition: { duration: 0.15 } },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      bounce: 0.25,
      visualDuration: 0.35,
      staggerChildren: 0.035,
      delayChildren: 0.06,
    },
  },
};
const ROW: Variants = {
  closed: { opacity: 0, y: 8 },
  open: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", bounce: 0.2, visualDuration: 0.3 },
  },
};

/** A menu tile: glass-white at rest, the brand yellow under the finger or pointer; the current page is outlined. */
const tile = (current: boolean) =>
  `group flex items-center rounded-2xl transition-colors duration-200 hover:bg-yellow-500 hover:text-ink active:bg-yellow-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 ${
    current ? "bg-yellow-100 ring-2 ring-yellow-500" : "bg-white/60"
  }`;

/**
 * Phone menu: a floating pane of the same frosted glass as the header, opening just under it, so the header (its
 * logo, search and cart) stays whole and its button turns into the close button. Categories in two columns, then
 * the help links and the language. A tap outside, Escape or following a link closes it.
 */
export function MobileMenu({ items }: { items: Item[] }) {
  const t = useTranslations("header");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(88);
  const button = useRef<HTMLButtonElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  // The pane goes to <body>, which only exists in the browser: nothing to render on the server.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Following a link closes the menu.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (open && openedOn !== pathname) {
    setOpen(false);
    setOpenedOn(pathname);
  }

  const show = () => {
    // Just under the floating header, whatever its height at this moment.
    const header = button.current?.closest("header")?.getBoundingClientRect();
    if (header) setTop(Math.round(header.bottom + 8));
    setOpenedOn(pathname);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    // Lifts the header above the dimmed page, and holds the page still under the pane.
    root.dataset.menu = "open";
    root.style.overflow = "hidden";
    pane.current
      ?.querySelector<HTMLElement>("a")
      ?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", esc);
    return () => {
      delete root.dataset.menu;
      root.style.overflow = "";
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const help = [
    { href: "/track", label: t("track"), icon: PackageSearch },
    { href: "/compare", label: t("compare"), icon: GitCompareArrows },
    { href: "/faq", label: t("help"), icon: CircleHelp },
  ];

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => (open ? close() : show())}
        aria-expanded={open}
        aria-controls="phone-menu"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        className={`grid size-11 cursor-pointer place-items-center rounded-full transition-colors md:hidden ${open ? "bg-ink text-white" : "hover:bg-ink/5"}`}
      >
        {/* The lines turn into the cross: a quarter turn, so the change reads as the same button. */}
        <MotionConfig reducedMotion="user">
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={open ? "close" : "open"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid place-items-center"
            >
              {open ? (
                <X className="size-6" aria-hidden="true" />
              ) : (
                <Menu className="size-6" aria-hidden="true" />
              )}
            </motion.span>
          </AnimatePresence>
        </MotionConfig>
      </button>

      {/* At the page root: the header's own glass would otherwise trap a fixed pane inside it. */}
      {!mounted
        ? null
        : createPortal(
            <MotionConfig reducedMotion="user">
              <AnimatePresence>
                {open ? (
                  <>
                    <motion.div
                      key="scrim"
                      aria-hidden="true"
                      onClick={() => close(false)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="fixed inset-0 z-[45] bg-ink/25 md:hidden"
                    />
                    <motion.div
                      key="pane"
                      ref={pane}
                      id="phone-menu"
                      role="dialog"
                      aria-label={t("menu")}
                      // Unfolds from the header, then its rows follow one after the other.
                      variants={PANE}
                      initial="closed"
                      animate="open"
                      exit="closed"
                      style={{ top, maxHeight: `calc(100dvh - ${top + 12}px)` }}
                      className="glass-frost fixed inset-x-3 z-50 origin-top overflow-y-auto overscroll-contain rounded-3xl border p-3 text-ink shadow-xl shadow-ink/15 select-none md:hidden"
                    >
                      <nav aria-label={t("categoriesNav")}>
                        <motion.p
                          variants={ROW}
                          className="flex items-center gap-2 px-1.5 pb-2 text-xs font-bold text-warm-600"
                        >
                          <span
                            className="h-1 w-4 rounded-full bg-yellow-500"
                            aria-hidden="true"
                          />
                          {t("categoriesNav")}
                          <span className="tabular-nums">· {items.length}</span>
                        </motion.p>
                        <ul className="grid grid-cols-2 gap-2">
                          {items.map((item) => {
                            const current = isCurrent(item.href);
                            return (
                              <motion.li
                                key={item.href}
                                variants={ROW}
                                whileTap={{ scale: 0.96 }}
                              >
                                <Link
                                  href={item.href}
                                  aria-current={current ? "page" : undefined}
                                  className={`${tile(current)} min-h-16 gap-2.5 p-2`}
                                >
                                  {/* White tile: category art is drawn for a light surface. It lifts a little on hover. */}
                                  <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm shadow-ink/10 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110">
                                    {item.image ? (
                                      <Image
                                        src={item.image}
                                        alt=""
                                        fill
                                        sizes="44px"
                                        unoptimized={item.image.endsWith(
                                          ".svg",
                                        )}
                                        className="object-contain p-1"
                                      />
                                    ) : null}
                                  </span>
                                  <span className="min-w-0 flex-1 leading-tight">
                                    <span className="block truncate text-sm font-bold">
                                      {item.label}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] font-semibold text-warm-600 group-hover:text-ink/70">
                                      {t("productCount", { count: item.count })}
                                    </span>
                                  </span>
                                  {current ? (
                                    <span
                                      className="size-2 shrink-0 rounded-full bg-ink"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                </Link>
                              </motion.li>
                            );
                          })}
                        </ul>
                      </nav>

                      <ul className="mt-3 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3">
                        {help.map(({ href, label, icon: Icon }) => (
                          <motion.li
                            key={href}
                            variants={ROW}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Link
                              href={href}
                              aria-current={
                                isCurrent(href) ? "page" : undefined
                              }
                              className={`${tile(isCurrent(href))} min-h-16 flex-col justify-center gap-1 px-1 text-center text-xs font-bold`}
                            >
                              <Icon
                                className="size-5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110"
                                aria-hidden="true"
                              />
                              {label}
                            </Link>
                          </motion.li>
                        ))}
                      </ul>

                      <motion.div variants={ROW} whileTap={{ scale: 0.98 }}>
                        <Link
                          href="/"
                          locale={locale === "ar" ? "en" : "ar"}
                          className="group mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-bold text-white transition-colors hover:bg-yellow-500 hover:text-ink active:bg-yellow-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
                        >
                          <Languages
                            className="size-4.5 transition-transform duration-300 group-hover:rotate-12"
                            aria-hidden="true"
                          />
                          {t("switchLanguage")}
                        </Link>
                      </motion.div>
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </MotionConfig>,
            document.body,
          )}
    </>
  );
}
