"use client";

import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/brand/Logo";
import { Link, usePathname } from "@/i18n/navigation";

type Item = { href: string; label: string; image: string | null };

/**
 * Phone menu: the hamburger opens the categories from the side (the start edge: right in Arabic).
 * A native modal <dialog> like the side cart: focus trapped, Esc and a tap outside close it.
 * Solid ink like the header, so the yellow "current" marker reads the same as on desktop.
 */
export function MobileMenu({ items }: { items: Item[] }) {
  const t = useTranslations("header");
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight;
  const close = () => ref.current?.close();

  // Following a link closes the menu.
  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkClass = (href: string) =>
    `flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold transition-colors ${
      isCurrent(href) ? "bg-white/10 text-white" : "text-warm-300 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Line the drawer's close button up with this button, so the X takes the hamburger's exact place.
          ref.current?.style.setProperty("--menu-top", `${e.currentTarget.getBoundingClientRect().top}px`);
          ref.current?.showModal();
        }}
        aria-haspopup="dialog"
        aria-label={t("openMenu")}
        className="grid size-11 cursor-pointer place-items-center rounded-full transition-colors hover:bg-ink/5 md:hidden"
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>

      <dialog
        ref={ref}
        aria-label={t("menu")}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="drawer drawer-start fixed inset-y-0 start-0 end-auto m-0 h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none rounded-e-glass border-e border-warm-700 bg-ink text-white backdrop:bg-ink/60 md:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-warm-700 px-4 pt-(--menu-top,0.75rem) pb-3">
            <button
              type="button"
              onClick={close}
              aria-label={t("closeMenu")}
              className="grid size-11 cursor-pointer place-items-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
            <Logo className="h-9 w-auto text-white" />
          </div>

          {/* select-none: quick taps on the rows must not leave text highlighted. */}
          <nav aria-label={t("categoriesNav")} className="flex-1 overflow-y-auto px-3 py-4 select-none">
            <p className="px-3 text-sm font-extrabold text-white">{t("categoriesNav")}</p>
            <span aria-hidden="true" className="mx-3 mt-2 mb-3 block h-1 w-6 rounded-full bg-yellow-500" />
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={isCurrent(item.href) ? "page" : undefined} className={linkClass(item.href)}>
                    {/* White tile: category art is drawn for a light surface. */}
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-white">
                      {item.image ? (
                        <Image src={item.image} alt="" fill sizes="40px" unoptimized={item.image.endsWith(".svg")} className="object-contain p-1" />
                      ) : null}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {isCurrent(item.href) ? (
                      <span aria-hidden="true" className="h-6 w-1 rounded-full bg-yellow-500" />
                    ) : (
                      <Chevron className="size-4 text-warm-500" aria-hidden="true" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            <ul className="mt-6 flex flex-col gap-1 border-t border-warm-700 pt-4">
              <li>
                <Link href="/track" className={linkClass("/track")}>
                  {t("track")}
                </Link>
              </li>
              <li>
                <Link href="/compare" className={linkClass("/compare")}>
                  {t("compare")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className={linkClass("/faq")}>
                  {t("help")}
                </Link>
              </li>
            </ul>
          </nav>

          <div className="border-t border-warm-700 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Link
              href="/"
              locale={locale === "ar" ? "en" : "ar"}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-warm-700 text-sm font-semibold text-white transition-colors hover:border-yellow-500"
            >
              {t("switchLanguage")}
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
