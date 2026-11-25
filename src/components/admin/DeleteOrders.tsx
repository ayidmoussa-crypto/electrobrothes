"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteOrders } from "@/app/actions/admin-orders";
import { useAdminTr } from "./AdminLang";
import { useConfirm } from "./ConfirmDialog";

/**
 * Deletes one order or the ticked ones, owner only, after asking. `icon`: a small bin on a board card; `button`: on
 * the order's page (goes back to the list after); `bar`: in the dark selection bar.
 */
export function DeleteOrders({ ids, label, variant, onDone }: { ids: string[]; label: string; variant: "icon" | "button" | "bar"; onDone?: () => void }) {
  const { tr } = useAdminTr();
  const router = useRouter();
  const [confirm, dialog] = useConfirm();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string; cleared: boolean } | null>(null);

  // The result stays a few seconds; only then does the selection clear (clearing it hides the bar holding this).
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => {
      setNotice(null);
      if (notice.cleared) onDone?.();
    }, 5000);
    return () => clearTimeout(t);
  }, [notice, onDone]);

  const run = async () => {
    const ok = await confirm({
      title: ids.length > 1 ? tr(`حذف ${ids.length} طلب؟`, `Delete ${ids.length} orders?`) : tr(`حذف الطلب ${label}؟`, `Delete order ${label}?`),
      yes: tr("نعم، احذف", "Yes, delete"),
      detail: (
        <ul className="list-disc ps-5">
          <li>{tr("الحذف نهائي، ما كيترجعش.", "Deleting is final.")}</li>
          <li>{tr("السلعة اللي كان حاجزها كترجع للمخزون.", "Goods it was holding go back to stock.")}</li>
          <li>{tr("الطلبات اللي خرجات مع التوصيل، ولا عندها تقييم، ما كتتحذفش.", "Orders that went out with the carrier, or have a review, are kept.")}</li>
        </ul>
      ),
    });
    if (!ok) return;
    start(async () => {
      const r = await deleteOrders(ids);
      setNotice({ ok: r.ok && r.deleted.length === ids.length, text: r.message, cleared: r.deleted.length > 0 });
      if (r.deleted.length) {
        if (variant === "button") router.push("/admin/orders");
        else router.refresh();
      }
    });
  };

  const text = ids.length > 1 ? tr(`حذف ${ids.length}`, `Delete ${ids.length}`) : tr("حذف الطلب", "Delete order");
  const Icon = pending ? LoaderCircle : Trash2;
  const icon = <Icon className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />;

  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={run} disabled={pending} aria-label={tr(`حذف الطلب ${label}`, `Delete order ${label}`)} title={tr("حذف", "Delete")} className="grid size-8 cursor-pointer place-items-center rounded-full text-warm-600 transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50">
          {icon}
        </button>
      ) : variant === "bar" ? (
        <button type="button" onClick={run} disabled={pending} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-warm-700 px-4 text-sm font-bold text-white transition-colors hover:border-danger hover:bg-danger disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
          {icon}
          {text}
        </button>
      ) : (
        <button type="button" onClick={run} disabled={pending} className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-danger/40 px-3 text-xs font-bold text-danger transition-colors hover:bg-danger-soft disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
          {icon}
          {text}
        </button>
      )}
      {dialog}
      {notice ? (
        <p role="status" className={`fixed inset-x-0 bottom-28 z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl lg:bottom-8 ${notice.ok ? "bg-ink text-white" : "bg-danger-soft text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </>
  );
}
