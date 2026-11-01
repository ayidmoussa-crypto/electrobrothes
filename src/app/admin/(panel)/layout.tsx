import { ExternalLink, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { logout } from "@/app/actions/admin-auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/brand/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireAdmin } from "@/lib/admin";

async function Shell({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  const brand = (
    <Link href="/admin" className="flex items-center gap-2 rounded-md text-white">
      <Logo className="h-8 w-auto" />
      <span className="font-extrabold" dir="ltr">
        ElectroBrothers
      </span>
    </Link>
  );
  const footer = (
    <div className="mt-auto flex flex-col gap-1 border-t border-warm-700 pt-3 text-sm">
      <p className="truncate px-3 text-warm-300" dir="ltr" title={admin.email}>
        {admin.email}
      </p>
      <Link href="/" target="_blank" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-warm-300 hover:bg-warm-900 hover:text-white">
        <ExternalLink className="size-5" aria-hidden="true" />
        عرض المتجر
      </Link>
      <form action={logout}>
        <button type="submit" className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-warm-300 hover:bg-warm-900 hover:text-white">
          <LogOut className="size-5" aria-hidden="true" />
          تسجيل الخروج
        </button>
      </form>
    </div>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 bg-ink p-4 lg:flex">
        {brand}
        <nav aria-label="أقسام لوحة التحكم">
          <AdminNav />
        </nav>
        {footer}
      </aside>

      {/* Mobile top bar with a fold-out menu */}
      <details className="sticky top-0 z-30 bg-ink lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 [&::-webkit-details-marker]:hidden">
          {brand}
          <span className="grid size-11 place-items-center text-white">
            <Menu className="size-6" aria-hidden="true" />
            <span className="sr-only">القائمة</span>
          </span>
        </summary>
        <nav aria-label="أقسام لوحة التحكم" className="flex flex-col gap-4 px-4 pb-4">
          <AdminNav />
          {footer}
        </nav>
      </details>

      <main className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
