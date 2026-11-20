"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import {
  Ban,
  Bot,
  Boxes,
  ChevronDown,
  ExternalLink,
  Footprints,
  Gift,
  Headset,
  LayoutDashboard,
  Landmark,
  LayoutGrid,
  LayoutTemplate,
  LifeBuoy,
  LogOut,
  MapPin,
  Moon,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Sun,
  Tags,
  TicketPercent,
  Trophy,
  Truck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/admin-auth";
import { setAdminTheme } from "@/app/actions/admin-lang";
import { useAdminTr } from "./AdminLang";

type Item = { href: string; label: [ar: string, en: string]; icon: LucideIcon; children?: Item[] };
type Role = "OWNER" | "AGENT";

const items: Item[] = [
  { href: "/admin", label: ["الإحصائيات", "Overview"], icon: LayoutDashboard },
  {
    href: "/admin/orders",
    label: ["الطلبات", "Orders"],
    icon: ShoppingCart,
    children: [
      { href: "/admin/orders", label: ["كل الطلبات", "All orders"], icon: ShoppingCart },
      { href: "/admin/orders/new", label: ["إضافة طلب", "New order"], icon: Plus },
      { href: "/admin/sales", label: ["أونلاين والمحل", "Online and shop"], icon: Store },
      { href: "/admin/staff", label: ["فريق التأكيد", "Confirmation team"], icon: Headset },
    ],
  },
  {
    href: "/admin/customers",
    label: ["الزبناء", "Customers"],
    icon: Users,
    children: [
      { href: "/admin/customers", label: ["كل الزبناء", "All customers"], icon: Users },
      { href: "/admin/visitors", label: ["الزوار والسلوك", "Visitors & behaviour"], icon: Footprints },
      { href: "/admin/support", label: ["الدعم التقني", "Technical support"], icon: LifeBuoy },
      { href: "/admin/reviews", label: ["التقييمات", "Reviews"], icon: Star },
      { href: "/admin/giveaways", label: ["السحوبات", "Giveaways"], icon: Trophy },
      { href: "/admin/blacklist", label: ["القائمة السوداء", "Blacklist"], icon: Ban },
    ],
  },
  {
    href: "/admin/products",
    label: ["المنتجات", "Products"],
    icon: Package,
    // "New" comes after the list: activeChild takes the last match, so the most specific address wins.
    children: [
      { href: "/admin/products", label: ["كل المنتجات", "All products"], icon: Package },
      { href: "/admin/products/new", label: ["إضافة منتج", "New product"], icon: Plus },
      { href: "/admin/categories", label: ["الأقسام", "Categories"], icon: Boxes },
      { href: "/admin/brands", label: ["الماركات", "Brands"], icon: Tags },
      { href: "/admin/bundles", label: ["الباكات", "Bundles"], icon: Gift },
      { href: "/admin/campaigns", label: ["استوديو العروض", "Campaign Studio"], icon: LayoutTemplate },
      { href: "/admin/coupons", label: ["الكوبونات", "Coupons"], icon: TicketPercent },
    ],
  },
  { href: "/admin/finance", label: ["المالية", "Finance"], icon: Landmark },
  { href: "/admin/seo", label: ["السيو", "SEO"], icon: Sparkles },
  {
    href: "/admin/settings",
    label: ["الإعدادات", "Settings"],
    icon: Settings,
    children: [
      { href: "/admin/settings", label: ["إعدادات المتجر", "Shop settings"], icon: Settings },
      { href: "/admin/cities", label: ["المدن والتوصيل", "Cities & delivery"], icon: MapPin },
      { href: "/admin/carriers", label: ["شركات التوصيل", "Delivery companies"], icon: Truck },
      // The assistant itself is the floating button; this is only its history.
      { href: "/admin/assistant", label: ["سجل المساعد", "Assistant log"], icon: Bot },
    ],
  },
];

// A confirmation agent's whole panel: their figures and the orders to call.
const agentItems: Item[] = [
  { href: "/admin/me", label: ["إحصائياتي", "My figures"], icon: Wallet },
  {
    href: "/admin/orders",
    label: ["الطلبات", "Orders"],
    icon: ShoppingCart,
    children: [
      { href: "/admin/orders", label: ["كل الطلبات", "All orders"], icon: ShoppingCart },
      { href: "/admin/orders/new", label: ["إضافة طلب", "New order"], icon: Plus },
    ],
  },
];
const itemsFor = (role: Role) => (role === "AGENT" ? agentItems : items);

// Phones: the daily sections sit in the bottom bar; the rest open from "المزيد".
const PRIMARY = ["/admin", "/admin/orders", "/admin/products", "/admin/me"];

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
  const { tr } = useAdminTr();
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
      <div className={`relative isolate flex items-center rounded-full text-sm font-semibold transition-colors ${current ? "on-yellow text-ink" : "text-warm-800 hover:bg-ink/5 hover:text-ink"}`}>
        {current ? <motion.span layoutId="admin-top-pill" transition={spring} aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-yellow-500 shadow-md shadow-yellow-500/25" /> : null}
        <Link href={item.href} aria-current={current?.href === item.href ? "page" : current ? "true" : undefined} className="flex min-h-10 items-center gap-2 rounded-s-full ps-3.5 pe-1">
          <Icon className="size-4.5" aria-hidden="true" />
          {tr(...item.label)}
        </Link>
        <button
          ref={arrow}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={tr(`صفحات ${item.label[0]}`, `${item.label[1]} pages`)}
          className="grid min-h-10 w-8 cursor-pointer place-items-center rounded-e-full"
        >
          <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {open ? (
        // The top padding is part of the panel, so the pointer never leaves it on the way down.
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="absolute start-0 top-full z-40 w-56 pt-2">
          <ul className="glass-frost rounded-2xl border p-1.5 shadow-lg shadow-ink/15">

            {children.map(({ href, label, icon: ChildIcon }) => {
              const active = current?.href === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
                      active ? "bg-yellow-500 text-ink" : "text-warm-800 hover:bg-ink/5 hover:text-ink"
                    }`}
                  >
                    <ChildIcon className="size-4.5" aria-hidden="true" />
                    {tr(...label)}
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
export function AdminTopNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const { tr } = useAdminTr();
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="admin-top">
        <ul className="flex flex-wrap items-center gap-1">
          {itemsFor(role).map((item) => {
            const { href, label, icon: Icon, children } = item;
            if (children) return <NavGroup key={href} item={item} pathname={pathname}>{children}</NavGroup>;
            const active = isActive(pathname, item);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative isolate flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                    active ? "on-yellow text-ink" : "text-warm-800 hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  {active ? (
                    <motion.span layoutId="admin-top-pill" transition={spring} aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-yellow-500 shadow-md shadow-yellow-500/25" />
                  ) : null}
                  <Icon className="size-4.5" aria-hidden="true" />
                  {tr(...label)}
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
 * Phones and tablets: a floating dark-glass bar at the bottom (thumb reach) with the daily
 * sections and "المزيد", which slides up a sheet with the other sections, the shop link and logout.
 */
export function AdminBottomNav({ email, role, night }: { email: string; role: Role; night: boolean }) {
  const pathname = usePathname();
  const { tr } = useAdminTr();
  // Remembers the page the sheet was opened on, so following a link closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);
  const all = itemsFor(role);
  const primary = all.filter((i) => PRIMARY.includes(i.href));
  const more = all.filter((i) => !PRIMARY.includes(i.href));
  const moreActive = more.some((i) => isActive(pathname, i));
  // Lists with their own tab in the bar and their own "add" button do not repeat in the sheet.
  const pagesOf = ({ children = [] }: Item) => children.filter((c) => !PRIMARY.includes(c.href) && !c.href.endsWith("/new"));
  const sections = all.filter((i) => pagesOf(i).length > 1);
  // A section left with a single page would spend a whole title on it: it joins the others.
  const others = [...all.filter((i) => pagesOf(i).length === 1).flatMap(pagesOf), ...more.filter((i) => !i.children)];
  const sheetGrid = (list: Item[]) => (
    <ul className="grid grid-cols-4 gap-1.5">
      {list.map((item) => {
        const { href, label, icon: Icon } = item;
        const active = isActive(pathname, item);
        return (
          <li key={href} className="flex">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center text-[0.6875rem] leading-tight font-semibold wrap-anywhere transition-[background-color,border-color,color,scale] duration-150 motion-safe:active:scale-95 ${
                active ? "border-yellow-500 bg-yellow-500 text-ink" : "border-warm-200 bg-white text-warm-800 hover:border-warm-300 hover:text-ink"
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {tr(...label)}
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
      active ? "on-yellow text-ink" : "text-warm-800"
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
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={tr("المزيد من الأقسام", "More sections")}
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              exit={{ y: "110%", transition: { duration: 0.18, ease: "easeIn" } }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              // Solid, not frosted: the tiles stay readable and a phone has no blur to redraw while it slides.
              className="fixed inset-x-3 bottom-3 z-50 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-warm-200 bg-warm-50 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-ink shadow-xl shadow-ink/20 lg:hidden"
            >
              <div className="mb-1 flex items-center justify-between gap-3 ps-2">
                {role === "OWNER" ? (
                  <Link href="/admin/account" className="truncate rounded-md text-sm text-warm-600 underline underline-offset-4 hover:text-ink" dir="ltr" title={tr("الحساب ديالي", "My account")}>
                    {email}
                  </Link>
                ) : (
                  <p className="truncate text-sm text-warm-600" dir="ltr" title={email}>
                    {email}
                  </p>
                )}
                <button type="button" onClick={close} aria-label={tr("إغلاق", "Close")} className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-ink/5">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              {sections.map((item) => (
                <div key={item.href} className="mb-2.5">
                  <p className="mb-1 px-2 text-xs font-bold text-warm-600">{tr(...item.label)}</p>
                  {sheetGrid(pagesOf(item))}
                </div>
              ))}
              {others.length ? (
                <>
                  <p className="mb-1 px-2 text-xs font-bold text-warm-600">{tr("باقي الأقسام", "Other sections")}</p>
                  {sheetGrid(others)}
                </>
              ) : null}
              <div className="mt-2.5 grid grid-cols-3 gap-1 border-t border-warm-200 pt-1.5 text-sm">
                <Link href="/" target="_blank" className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-warm-800 hover:bg-ink/5 hover:text-ink">
                  <ExternalLink className="size-4.5" aria-hidden="true" />
                  {tr("المتجر", "Shop")}
                </Link>
                {/* On phones the night switch lives here: the top bar has no room left. */}
                <form action={setAdminTheme}>
                  <input type="hidden" name="theme" value={night ? "light" : "dark"} />
                  <button type="submit" className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-warm-800 hover:bg-ink/5 hover:text-ink">
                    {night ? <Sun className="size-4.5" aria-hidden="true" /> : <Moon className="size-4.5" aria-hidden="true" />}
                    {night ? tr("عادي", "Normal") : tr("ليلي", "Night")}
                  </button>
                </form>
                <form action={logout}>
                  <button type="submit" className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-warm-800 hover:bg-ink/5 hover:text-ink">
                    <LogOut className="size-4.5" aria-hidden="true" />
                    {tr("خروج", "Log out")}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <nav aria-label={tr("أقسام لوحة التحكم", "Dashboard sections")} className="glass-frost fixed inset-x-3 bottom-3 z-30 rounded-3xl border p-1.5 shadow-lg shadow-ink/15 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden">
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
                    {tr(...label)}
                  </Link>
                </li>
              );
            })}
            <li className="flex flex-1">
              <button type="button" onClick={() => setOpenOn(open ? null : pathname)} aria-expanded={open} aria-haspopup="dialog" className={`${tab(moreActive || open)} cursor-pointer`}>
                {moreActive || open ? pill : null}
                <LayoutGrid className="size-5" aria-hidden="true" />
                {tr("المزيد", "More")}
              </button>
            </li>
          </ul>
        </LayoutGroup>
      </nav>
    </MotionConfig>
  );
}
