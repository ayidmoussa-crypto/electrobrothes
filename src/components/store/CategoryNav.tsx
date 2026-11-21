"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";

type Item = { href: string; label: string; image?: string | null };
type Pos = { x: number; w: number; visible: boolean; animate: boolean };

/**
 * Desktop category strip on the header's glass (phones use the side menu). One yellow pill glides to
 * the hovered (or focused) category and settles back on the current one, which also carries a small
 * ink marker inside the pill.
 */
export function CategoryNav({ items, label }: { items: Item[]; label: string }) {
  const pathname = usePathname();
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const [pos, setPos] = useState<Pos>({ x: 0, w: 0, visible: false, animate: false });
  const activeHref = items.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.href;

  const moveTo = useCallback((href: string | undefined) => {
    const el = href ? links.current.get(href) : undefined;
    setPos((p) =>
      el
        ? // Glide only when the pill is already showing; otherwise appear in place.
          { x: el.offsetLeft, w: el.offsetWidth, visible: true, animate: p.visible }
        : { ...p, visible: false },
    );
  }, []);
  const rest = useCallback(() => moveTo(activeHref), [moveTo, activeHref]);

  useLayoutEffect(() => {
    rest();
    window.addEventListener("resize", rest);
    return () => window.removeEventListener("resize", rest);
  }, [rest]);

  return (
    // Transparent: takes the header's glass.
    // From xl it sits in the bar's one row between the logo and the search; below that it wraps onto a full-width
    // second row under a hairline (the negative margins reach the bar's edges through its padding).
    <nav
      aria-label={label}
      className="max-md:hidden max-xl:order-last max-xl:-mx-4 max-xl:mt-3 max-xl:-mb-3 max-xl:basis-[calc(100%+2rem)] max-xl:border-t max-xl:border-ink/10"
    >
      <ul
        onMouseLeave={rest}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && rest()}
        className="relative isolate flex items-center gap-1 max-xl:mx-auto max-xl:max-w-7xl max-xl:px-6 max-xl:py-2"
      >
        <li
          aria-hidden="true"
          style={{ transform: `translateX(${pos.x}px)`, width: pos.w }}
          // Physical left-0: offsetLeft is measured from the left in both directions.
          className={`pointer-events-none absolute inset-y-2 left-0 xl:inset-y-0 -z-10 rounded-full bg-yellow-500 shadow-md shadow-yellow-500/40 ring-1 ring-yellow-700/20 ${
            pos.animate ? "transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" : "transition-opacity duration-200"
          } ${pos.visible ? "opacity-100" : "opacity-0"}`}
        />
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                ref={(el) => {
                  if (el) links.current.set(item.href, el);
                  else links.current.delete(item.href);
                }}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => moveTo(item.href)}
                onFocus={() => moveTo(item.href)}
                className="relative inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm xl:px-4 font-semibold text-ink transition-[color,translate] duration-300 hover:-translate-y-px"
              >
                {item.label}
                {active ? <span aria-hidden="true" className="absolute bottom-1 h-1 w-5 rounded-full bg-ink" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
