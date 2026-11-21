import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/States";
import { adminTheme, adminTr } from "@/lib/admin-lang";

/** An address under /admin that matches no page at all (outside the panel, so no menu). */
export default async function AdminNotFound() {
  const [{ tr, ar }, theme] = await Promise.all([adminTr(), adminTheme()]);
  return (
    <div dir={ar ? "rtl" : "ltr"} className={`admin-theme grid min-h-dvh place-items-center bg-(--admin-page-bg) ${theme === "dark" ? "admin-dark" : ""}`}>
      <StatePanel
        icon={SearchX}
        title={tr("ما لقينا هاد الصفحة", "Page not found")}
        description={tr("هاد العنوان ما كاينش فلوحة التحكم.", "This address does not exist in the dashboard.")}
        action={
          <Link href="/admin" className={buttonClass()}>
            {tr("لوحة التحكم", "Dashboard")}
          </Link>
        }
      />
    </div>
  );
}
