"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refreshCarrierStatuses } from "@/app/actions/admin-orders";
import { buttonClass } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useAdminTr } from "./AdminLang";

/** Pulls the parcels' latest steps from the connected delivery companies. */
export function RefreshStatuses() {
  const { tr } = useAdminTr();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refreshCarrierStatuses();
          (r.ok ? toast.success : toast.error)(r.message ?? "");
          router.refresh();
        })
      }
      className={buttonClass({ variant: "ghost", className: "max-lg:hidden" })}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
      {tr("تحديث الحالات", "Refresh statuses")}
    </button>
  );
}
