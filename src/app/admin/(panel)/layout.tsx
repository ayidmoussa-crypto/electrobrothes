import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { logout } from "@/app/actions/admin-auth";
import { setAdminLang } from "@/app/actions/admin-lang";
import { adminTr } from "@/lib/admin-lang";
import { AdminBackdrop } from "@/components/admin/AdminBackdrop";
import { AdminLangProvider } from "@/components/admin/AdminLang";
import { AdminBottomNav, AdminTopNav } from "@/components/admin/AdminNav";
import { AssistantWidget } from "@/components/admin/AssistantWidget";
import { NotificationsButton } from "@/components/admin/NotificationsButton";
import { loadAlerts } from "@/lib/admin-alerts-data";
import { Logo } from "@/components/brand/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireStaff } from "@/lib/admin";

const iconLink = "grid size-10 cursor-pointer place-items-center rounded-full text-warm-800 transition-colors hover:bg-ink/5 hover:text-ink";

async function Shell({ children }: { children: ReactNode }) {
  const [admin, { lang, ar, tr }] = await Promise.all([requireStaff(), adminTr()]);
  const agent = admin.role === "AGENT";
  const alerts = await loadAlerts(admin.role, tr, ar);

  return (
    // The whole panel follows the chosen language: direction, lang tag and every text below.
    <div dir={ar ? "rtl" : "ltr"} lang={lang}>
      <AdminLangProvider lang={lang}>
        <AdminBackdrop />

        {/* The shop's floating frosted-glass bar, clear of the screen edges. Desktop: brand + account row, then
            the sections row. Phones: brand row only. */}
        <header className="sticky top-3 z-30 mx-3 mt-3 rounded-3xl text-ink lg:mx-4">
          {/* The glass sits on its own layer: a blur on the header itself would stop its menus from blurring the page. */}
          <div aria-hidden="true" className="glass-frost absolute inset-0 -z-10 rounded-[inherit] border shadow-lg shadow-ink/10" />
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
            <Link href={agent ? "/admin/me" : "/admin"} className="flex items-center gap-2.5 rounded-md">
              <Logo className="h-8 w-auto text-logo-dark" />
              <span className="leading-tight">
                <span className="block font-extrabold" dir="ltr">
                  ElectroBrothers
                </span>
                <span className="block text-xs text-warm-600">{agent ? tr("فريق التأكيد", "Confirmation team") : tr("لوحة التحكم", "Dashboard")}</span>
              </span>
            </Link>
            <div className="flex items-center gap-1">
              {/* Panel language, in the header so every admin page has it. */}
              <form action={setAdminLang} aria-label={tr("لغة اللوحة", "Panel language")} className="flex rounded-full bg-ink/5 p-1 lg:me-1">
                {(["ar", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="submit"
                    name="lang"
                    value={l}
                    aria-pressed={lang === l}
                    // Phones show only the other language, to leave room for the bell and the assistant.
                    className={`inline-flex min-h-8 min-w-9 cursor-pointer items-center justify-center rounded-full px-2.5 text-sm font-bold transition-colors ${lang === l ? "bg-yellow-500 text-ink max-lg:hidden" : "text-warm-600 hover:text-ink"}`}
                  >
                    {l === "ar" ? "ع" : "EN"}
                  </button>
                ))}
              </form>
              <p className="me-2 hidden max-w-56 truncate text-sm text-warm-600 lg:block" dir="ltr" title={admin.email}>
                {admin.email}
              </p>
              {/* Phones: the bell and the assistant live here; the shop link and logout are in "المزيد". */}
              <div className="flex items-center gap-1.5 lg:hidden">
                <NotificationsButton groups={alerts} placement="bar" />
                {agent ? null : <AssistantWidget placement="bar" />}
              </div>
              <Link href="/" target="_blank" className={`${iconLink} max-lg:hidden`} aria-label={tr("عرض المتجر", "View shop")} title={tr("عرض المتجر", "View shop")}>
                <ExternalLink className="size-5" aria-hidden="true" />
              </Link>
              <form action={logout} className="max-lg:hidden">
                <button type="submit" className={iconLink} aria-label={tr("تسجيل الخروج", "Log out")} title={tr("تسجيل الخروج", "Log out")}>
                  <LogOut className="size-5" aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
          <nav aria-label={tr("أقسام لوحة التحكم", "Dashboard sections")} className="hidden border-t border-ink/10 lg:block">
            <div className="mx-auto max-w-7xl px-4 py-2 lg:px-6">
              <AdminTopNav role={admin.role} />
            </div>
          </nav>
        </header>

        {/* Desktop: a floating glass rail on the side with the bell and the assistant, always in reach. */}
        <aside aria-label={tr("الإشعارات والمساعد", "Notifications and assistant")} className="fixed inset-y-0 end-4 z-40 my-auto hidden h-fit flex-col items-center gap-2 rounded-full p-2 lg:flex">
          <div aria-hidden="true" className="glass-frost absolute inset-0 -z-10 rounded-[inherit] border shadow-lg shadow-ink/10" />
          <NotificationsButton groups={alerts} placement="rail" />
          {/* The assistant changes stock and products, and spends the API budget: the owner's alone. */}
          {agent ? null : <AssistantWidget placement="rail" />}
        </aside>

        {/* Bottom padding on phones clears the floating bottom bar; on desktop the end padding clears the side rail. */}
        <main className="mx-auto min-w-0 max-w-7xl px-4 pt-6 pb-32 md:pt-8 lg:px-6 lg:pe-24 lg:pb-12 2xl:pe-6">{children}</main>

        <AdminBottomNav email={admin.email} role={admin.role} />
      </AdminLangProvider>
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
