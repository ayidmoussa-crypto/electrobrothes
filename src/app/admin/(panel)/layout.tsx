import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { logout } from "@/app/actions/admin-auth";
import { AdminBackdrop } from "@/components/admin/AdminBackdrop";
import { AdminBottomNav, AdminTopNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/brand/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireAdmin } from "@/lib/admin";

const iconLink = "grid size-10 cursor-pointer place-items-center rounded-full text-warm-300 transition-colors hover:bg-white/10 hover:text-white";

async function Shell({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <>
      <AdminBackdrop />

      {/* Smoked-glass header. Desktop: brand + account row, then the sections row. Phones: brand row only. */}
      <header className="glass-dark sticky top-0 z-30 rounded-b-3xl border-b text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <Link href="/admin" className="flex items-center gap-2.5 rounded-md">
            <Logo className="h-8 w-auto" />
            <span className="leading-tight">
              <span className="block font-extrabold" dir="ltr">
                ElectroBrothers
              </span>
              <span className="block text-xs text-warm-300">لوحة التحكم</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <p className="me-2 hidden max-w-56 truncate text-sm text-warm-300 lg:block" dir="ltr" title={admin.email}>
              {admin.email}
            </p>
            <Link href="/" target="_blank" className={iconLink} aria-label="عرض المتجر" title="عرض المتجر">
              <ExternalLink className="size-5" aria-hidden="true" />
            </Link>
            <form action={logout}>
              <button type="submit" className={iconLink} aria-label="تسجيل الخروج" title="تسجيل الخروج">
                <LogOut className="size-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="أقسام لوحة التحكم" className="hidden border-t border-white/10 lg:block">
          <div className="mx-auto max-w-7xl px-4 py-2 lg:px-6">
            <AdminTopNav />
          </div>
        </nav>
      </header>

      {/* Bottom padding on phones clears the floating bottom bar. */}
      <main className="mx-auto min-w-0 max-w-7xl px-4 pt-6 pb-32 md:pt-8 lg:px-6 lg:pb-12">{children}</main>

      <AdminBottomNav email={admin.email} />
    </>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
