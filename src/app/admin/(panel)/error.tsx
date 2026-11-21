"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useAdminTr } from "@/components/admin/AdminLang";
import { buttonClass } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/States";
import { toast } from "@/lib/toast";

/** A panel page that crashed: the header and menu stay, only this page is replaced, and "Try again" re-renders it. */
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { tr } = useAdminTr();

  useEffect(() => {
    console.error(error);
    toast.error(tr("هاد الصفحة ما بغاتش تشتغل. جرب مرة أخرى.", "This page failed to load. Try again."));
  }, [error, tr]);

  return (
    <div className="py-6">
      <StatePanel
        role="alert"
        tone="danger"
        icon={TriangleAlert}
        title={tr("وقع خطأ فهاد الصفحة", "Something went wrong on this page")}
        description={error.digest ? `${tr("رمز الخطأ", "Error code")}: ${error.digest}` : tr("ما قدرناش نحملو هاد الصفحة.", "We could not load this page.")}
        action={
          <>
            <button type="button" onClick={reset} className={buttonClass()}>
              {tr("عاود", "Try again")}
            </button>
            <Link href="/admin" className={buttonClass({ variant: "outline" })}>
              {tr("الإحصائيات", "Overview")}
            </Link>
          </>
        }
      />
    </div>
  );
}
