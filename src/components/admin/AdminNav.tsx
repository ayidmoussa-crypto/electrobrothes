"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "framer-motion";
import {
  Ban,
  Bot,
  Boxes,
  ExternalLink,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Tags,
  TicketPercent,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/actions/admin-auth";

type Item = { href: string; label: string; icon: LucideIcon };

const items: Item[] = [
  { href: "/admin", label: "الإحصائيات", icon: LayoutDashboard },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingCart },
  { href: "/admin/products", label: "المنتجات", icon: Package },
  { href: "/admin/categories", label: "الأقسام", icon: Boxes },
  { href: "/admin/brands", label: "الماركات", icon: Tags },
  { href: "/admin/cities", label: "المدن والتوصيل", icon: MapPin },
  { href: "/admin/coupons", label: "الكوبونات", icon: TicketPercent },
  { href: "/admin/blacklist", label: "القائمة السوداء", icon: Ban },
  { href: "/admin/assistant", label: "سجل المساعد", icon: Bot },
  { href: "/admin/seo", label: "السيو", icon: Sparkles },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

// Phones: the four daily sections sit in the bottom bar; the rest open from "المزيد".
const PRIMARY = ["/admin", "/admin/orders", "/admin/products", "/admin/settings"];

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
const spring = { type: "spring", stiffness: 420, damping: 36 } as const;

/** Desktop: one row of sections under the header; a yellow pill glides to the current one. */
export function AdminTopNav() {
  const pathname = usePathname();
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="admin-top">
        <ul className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
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
  const moreActive = more.some((i) => isActive(pathname, i.href));

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
              className="glass-dark fixed inset-x-3 bottom-3 z-50 rounded-3xl border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white lg:hidden"
            >
              <div className="mb-2 flex items-center justify-between gap-3 px-2">
                <p className="truncate text-sm text-warm-300" dir="ltr" title={email}>
                  {email}
                </p>
                <button type="button" onClick={close} aria-label="إغلاق" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-white/10">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <ul className="grid grid-cols-3 gap-2">
                {more.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
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
            {primary.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href) && !open;
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
