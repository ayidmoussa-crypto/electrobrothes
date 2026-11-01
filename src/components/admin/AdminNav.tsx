"use client";

import { Ban, Boxes, LayoutDashboard, MapPin, Package, Settings, ShoppingCart, Tags, TicketPercent } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "الإحصائيات", icon: LayoutDashboard },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingCart },
  { href: "/admin/products", label: "المنتجات", icon: Package },
  { href: "/admin/categories", label: "الأقسام", icon: Boxes },
  { href: "/admin/brands", label: "الماركات", icon: Tags },
  { href: "/admin/cities", label: "المدن والتوصيل", icon: MapPin },
  { href: "/admin/coupons", label: "الكوبونات", icon: TicketPercent },
  { href: "/admin/blacklist", label: "القائمة السوداء", icon: Ban },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

/** Black sidebar; the active section is marked in yellow (brand rule). */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${
                active ? "bg-yellow-500 text-ink" : "text-warm-300 hover:bg-warm-900 hover:text-white"
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
}
