"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "framer-motion";
import {
  Ban,
  Bot,
  Boxes,
  ChevronDown,
  ExternalLink,
  Gift,
  LayoutDashboard,
  Landmark,
  LayoutGrid,
  LogOut,
  MapPin,
  MessagesSquare,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  Tags,
  TicketPercent,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/admin-auth";

type Item = { href: string; label: string; icon: LucideIcon; children?: Item[] };

const items: Item[] = [
  { href: "/admin", label: "الإحصائيات", icon: LayoutDashboard },
  {
    href: "/admin/orders",
    label: "الطلبات",
    icon: ShoppingCart,
    children: [
      { href: "/admin/orders", label: "كل الطلبات", icon: ShoppingCart },
      { href: "/admin/orders/new", label: "إضافة طلب", icon: Plus },
    ],
  },
  {
    href: "/admin/inbox",
    label: "الرسائل",
    icon: MessagesSquare,
    children: [
      { href: "/admin/inbox", label: "المحادثات", icon: MessagesSquare },
      { href: "/admin/automations", label: "الأتمتة", icon: Zap },
    ],
  },
  {
    href: "/admin/customers",
    label: "الزبناء",
    icon: Users,
    children: [
      { href: "/admin/customers", label: "كل الزبناء", icon: Users },
      { href: "/admin/reviews", label: "التقييمات", icon: Star },
      { href: "/admin/blacklist", label: "القائمة السوداء", icon: Ban },
    ],
  },
  {
    href: "/admin/products",
    label: "المنتجات",
    icon: Package,
    // "New" comes after the list: activeChild takes the last match, so the most specific address wins.
    children: [
      { href: "/admin/products", label: "كل المنتجات", icon: Package },
      { href: "/admin/products/new", label: "إضافة منتج", icon: Plus },
      { href: "/admin/categories", label: "الأقسام", icon: Boxes },
      { href: "/admin/brands", label: "الماركات", icon: Tags },
      { href: "/admin/bundles", label: "الباكات", icon: Gift },
      { href: "/admin/coupons", label: "الكوبونات", icon: TicketPercent },
    ],
  },
  { href: "/admin/finance", label: "المالية", icon: Landmark },
  { href: "/admin/seo", label: "السيو", icon: Sparkles },
  {
    href: "/admin/settings",
    label: "الإعدادات",
    icon: Settings,
    children: [
      { href: "/admin/settings", label: "إعدادات المتجر", icon: Settings },
      { href: "/admin/cities", label: "المدن والتوصيل", icon: MapPin },
      // The assistant itself is the floating button; this is only its history.
      { href: "/admin/assistant", label: "سجل المساعد", icon: Bot },
    ],
  },
];

// Phones: the four daily sections sit in the bottom bar; the rest open from "المزيد".
const PRIMARY = ["/admin", "/admin/orders", "/admin/inbox", "/admin/products"];

const activeChild = (pathname: string, children: Item[]) => children.filter((c) => pathname.startsWith(c.href)).at(-1);
const isActive = (pathname: string, { href, children }: Item) =>
  children ? Boolean(activeChild(pathname, children)) : href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
const spring = { type: "spring", stiffness: 420, damping: 36 } as const;

/**
 * A section with sub-pages, like the WooCommerce sidebar: the name goes to the main list, and the
 * sub-pages open on hover or from the arrow (touch screens and keyboards have no hover).
 */
function NavGroup({ item, children, pathname }: { item: Item; children: Item[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLLIElement>(null);
  const arrow = useRef<HTMLButtonElement>(null);
  const current = activeChild(pathname, children);
  const Icon = item.icon;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <li
      ref={root}
      className="relative shrink-0"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          arrow.current?.focus();
        }
      }}
    >
      <div className={`relative isolate flex items-center rounded-full text-sm font-semibold transition-colors ${current ? "text-ink" : "text-warm-300 hover:bg-white/10 hover:text-white"}`}>
        {current ? <motion.span layoutId="admin-top-pill" transition={spring} aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-yellow-500 shadow-md shadow-yellow-500/25" /> : null}
        <Link href={item.href} aria-current={current?.href === item.href ? "page" : current ? "true" : undefined} className="flex min-h-10 items-center gap-2 rounded-s-full ps-3.5 pe-1">
          <Icon className="size-4.5" aria-hidden="true" />
          {item.label}
        </Link>
        <button
          ref={arrow}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`صفحات ${item.label}`}
          className="grid min-h-10 w-8 cursor-pointer place-items-center rounded-e-full"
        >
          <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {open ? (
        // The top padding is part of the panel, so the pointer never leaves it on the way down.
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="absolute start-0 top-full z-40 w-56 pt-2">
          <ul className="rounded-2xl border border-warm-700 bg-warm-900 p-1.5 shadow-lg shadow-ink/30">
            {children.map(({ href, label, icon: ChildIcon }) => {
              const active = current?.href === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
                      active ? "bg-yellow-500 text-ink" : "text-warm-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <ChildIcon className="size-4.5" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.div>
      ) : null}
    </li>
  );
}

/** Desktop: the sections under the header; a yellow pill glides to the current one. Wraps rather than scrolls, which would clip the sub-page panel. */
export function AdminTopNav() {
  const pathname = usePathname();
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="admin-top">
        <ul className="flex flex-wrap items-center gap-1">
          {items.map((item) => {
            const { href, label, icon: Icon, children } = item;
            if (children) return <NavGroup key={href} item={item} pathname={pathname}>{children}</NavGroup>;
            const active = isActive(pathname, item);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative isolate flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                    active ? "text-ink" : "text-warm-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {active ? (
                    <motion.span layoutId="admin-top-pill" transition={spring} aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-yellow-500 shadow-md shadow-yellow-500/25" />
                  ) : null}
                  <Icon className="size-4.5" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </MotionConfig>
  );
}

/**
 * Phones and tablets: a floating dark-glass bar at the bottom (thumb reach) with the four daily
 * sections and "المزيد", which slides up a sheet with the other sections, the shop link and logout.
 */
export function AdminBottomNav({ email }: { email: string }) {
  const pathname = usePathname();
  // Remembers the page the sheet was opened on, so following a link closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);
  const primary = items.filter((i) => PRIMARY.includes(i.href));
  const more = items.filter((i) => !PRIMARY.includes(i.href));
  const moreActive = more.some((i) => isActive(pathname, i));
  const groups = items.filter((i) => i.children);
  const sheetGrid = (list: Item[]) => (
    <ul className="grid grid-cols-3 gap-2">
      {list.map((item) => {
        const { href, label, icon: Icon } = item;
        const active = isActive(pathname, item);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl px-2 text-center text-xs font-semibold transition-colors ${
                active ? "bg-yellow-500 text-ink" : "bg-white/5 text-warm-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tab = (active: boolean) =>
    `relative isolate flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[0.6875rem] font-semibold transition-colors ${
      active ? "text-ink" : "text-warm-300"
    }`;
  const pill = <motion.span layoutId="admin-bottom-pill" transition={spring} aria-hidden="true" className="absolute inset-1 -z-10 rounded-xl bg-yellow-500" />;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="scrim"
              aria-hidden="true"
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="المزيد من الأقسام"
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              exit={{ y: "110%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="glass-dark fixed inset-x-3 bottom-3 z-50 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white lg:hidden"
            >
              <div className="mb-2 flex items-center justify-between gap-3 px-2">
                <p className="truncate text-sm text-warm-300" dir="ltr" title={email}>
                  {email}
                </p>
                <button type="button" onClick={close} aria-label="إغلاق" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-white/10">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              {/* Lists with their own tab in the bar and their own "add" button do not repeat here. */}
              {groups.map(({ href, label, children = [] }) => {
                const pages = children.filter((c) => !PRIMARY.includes(c.href) && !c.href.endsWith("/new"));
                return pages.length ? (
                  <div key={href} className="mb-3">
                    <p className="mb-2 px-2 text-xs font-bold text-warm-300">{label}</p>
                    {sheetGrid(pages)}
                  </div>
                ) : null;
              })}
              <p className="mb-2 px-2 text-xs font-bold text-warm-300">باقي الأقسام</p>
              {sheetGrid(more.filter((i) => !i.children))}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-sm">
                <Link href="/" target="_blank" className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-warm-300 hover:bg-white/10 hover:text-white">
                  <ExternalLink className="size-4.5" aria-hidden="true" />
                  عرض المتجر
                </Link>
                <form action={logout}>
                  <button type="submit" className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-warm-300 hover:bg-white/10 hover:text-white">
                    <LogOut className="size-4.5" aria-hidden="true" />
                    تسجيل الخروج
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <nav aria-label="أقسام لوحة التحكم" className="glass-dark fixed inset-x-3 bottom-3 z-30 rounded-3xl border p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden">
        <LayoutGroup id="admin-bottom">
          <ul className="isolate flex items-stretch gap-1">
            {primary.map((item) => {
              const { href, label, icon: Icon } = item;
              const active = isActive(pathname, item) && !open;
              return (
                <li key={href} className="flex flex-1">
                  <Link href={href} aria-current={active ? "page" : undefined} className={tab(active)}>
                    {active ? pill : null}
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
            <li className="flex flex-1">
              <button type="button" onClick={() => setOpenOn(open ? null : pathname)} aria-expanded={open} aria-haspopup="dialog" className={`${tab(moreActive || open)} cursor-pointer`}>
                {moreActive || open ? pill : null}
                <LayoutGrid className="size-5" aria-hidden="true" />
                المزيد
              </button>
            </li>
          </ul>
        </LayoutGroup>
      </nav>
    </MotionConfig>
  );
}
