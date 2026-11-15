"use client";

import { CircleHelp, GitCompareArrows, Languages, Menu, PackageSearch, X } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/navigation";

type Item = { href: string; label: string; image: string | null };

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
    pane.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
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

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
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
        {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
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
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      style={{ top, maxHeight: `calc(100dvh - ${top + 12}px)` }}
                      className="glass-frost fixed inset-x-3 z-50 origin-top overflow-y-auto overscroll-contain rounded-3xl border p-3 text-ink shadow-xl shadow-ink/15 select-none md:hidden"
                    >
                      <nav aria-label={t("categoriesNav")}>
                        <p className="px-1.5 pb-2 text-xs font-bold text-warm-600">{t("categoriesNav")}</p>
                        <ul className="grid grid-cols-2 gap-2">
                          {items.map((item) => {
                            const current = isCurrent(item.href);
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  aria-current={current ? "page" : undefined}
                                  className={`flex min-h-14 items-center gap-2.5 rounded-2xl p-2 text-sm font-bold transition-colors ${current ? "bg-white ring-2 ring-yellow-500" : "bg-white/60 hover:bg-white"}`}
                                >
                                  {/* White tile: category art is drawn for a light surface. */}
                                  <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-white">
                                    {item.image ? <Image src={item.image} alt="" fill sizes="40px" unoptimized={item.image.endsWith(".svg")} className="object-contain p-1" /> : null}
                                  </span>
                                  <span className="min-w-0 leading-tight">{item.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </nav>

                      <ul className="mt-3 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3">
                        {help.map(({ href, label, icon: Icon }) => (
                          <li key={href}>
                            <Link
                              href={href}
                              aria-current={isCurrent(href) ? "page" : undefined}
                              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-xs font-bold transition-colors ${isCurrent(href) ? "bg-white ring-2 ring-yellow-500" : "bg-white/60 hover:bg-white"}`}
                            >
                              <Icon className="size-5" aria-hidden="true" />
                              {label}
                            </Link>
                          </li>
                        ))}
                      </ul>

                      <Link
                        href="/"
                        locale={locale === "ar" ? "en" : "ar"}
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-bold text-white transition-colors hover:bg-warm-900"
                      >
                        <Languages className="size-4.5" aria-hidden="true" />
                        {t("switchLanguage")}
                      </Link>
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
