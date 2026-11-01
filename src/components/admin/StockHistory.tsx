import Link from "next/link";
import type { stockHistory } from "@/lib/admin-products";
import { formatMAD } from "@/lib/money";
import { STOCK_REASON_LABEL } from "@/lib/stock";
import { TIME_ZONE } from "@/lib/time";
import { Panel, tdClass, thClass } from "./ui";

const when = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });

/** The product's stock ledger: every in / out per colour, why, and the purchase price at that moment. */
export function StockHistory({ rows }: { rows: Awaited<ReturnType<typeof stockHistory>> }) {
  return (
    <Panel title="سجل حركات المخزون">
      {rows.length ? (
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[44rem]">
            <thead className="border-b border-white/70 bg-white/45">
              <tr>
                {["التاريخ", "اللون", "الحركة", "بعدها", "السبب", "سعر الشراء", "بواسطة"].map((h) => (
                  <th key={h} className={thClass}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-warm-200/60 last:border-0">
                  <td className={`${tdClass} whitespace-nowrap`}>{when.format(m.createdAt)}</td>
                  <td className={tdClass}>
                    {m.colorLabel ?? "—"}
                    <span className="block text-xs text-warm-500" dir="ltr">
                      {m.sku}
                    </span>
                  </td>
                  <td className={`${tdClass} font-bold ${m.delta > 0 ? "text-success" : "text-danger"}`} dir="ltr">
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className={tdClass}>{m.stockAfter}</td>
                  <td className={tdClass}>
                    {STOCK_REASON_LABEL[m.reason]}
                    {m.orderId && m.orderNumber ? (
                      <Link href={`/admin/orders/${m.orderId}`} className="ms-1 font-mono text-xs underline underline-offset-2" dir="ltr">
                        {m.orderNumber}
                      </Link>
                    ) : null}
                    {m.note ? <span className="block text-xs text-warm-500">{m.note}</span> : null}
                  </td>
                  <td className={tdClass}>{m.unitCost === null ? "—" : formatMAD(m.unitCost, "ar")}</td>
                  <td className={`${tdClass} max-w-40 truncate text-xs text-warm-600`} dir="ltr" title={m.actor}>
                    {m.actor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-warm-600">لا توجد حركات بعد.</p>
      )}
    </Panel>
  );
}
