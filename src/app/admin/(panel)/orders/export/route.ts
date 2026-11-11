import type { NextRequest } from "next/server";
import { getOwner } from "@/lib/admin";
import { orderWhere, parseOrderFilters } from "@/lib/admin-orders";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { cashToCollect } from "@/lib/order-rules";
import { formatMoroccanPhone } from "@/lib/phone";

// Delivery-company sheet: one row per order with the cash amount to collect.
export async function GET(request: NextRequest) {
  if (!(await getOwner())) return new Response("Unauthorized", { status: 401 });

  const f = parseOrderFilters(Object.fromEntries(request.nextUrl.searchParams));
  // Orders ticked in the list: exactly those, whatever the filters.
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter((id) => /^[a-z0-9]{1,40}$/.test(id)).slice(0, 500);
  const orders = await db.order.findMany({
    where: ids.length ? { id: { in: ids } } : orderWhere(f),
    orderBy: { createdAt: "asc" },
    take: 5000,
    include: { items: { select: { nameAr: true, variantLabel: true, quantity: true } } },
  });

  const csv = toCsv([
    ["رقم الطلب", "التاريخ", "الاسم", "الهاتف", "المدينة", "العنوان", "المنتجات", "عدد القطع", "المبلغ عند الاستلام (درهم)", "ملاحظات", "الحالة"],
    ...orders.map((o) => [
      o.number,
      o.createdAt.toISOString().slice(0, 16).replace("T", " "),
      o.customerName,
      formatMoroccanPhone(o.phone),
      o.cityName,
      o.address,
      o.items.map((i) => `${i.nameAr}${i.variantLabel ? ` (${i.variantLabel})` : ""} ×${i.quantity}`).join(" | "),
      o.items.reduce((n, i) => n + i.quantity, 0),
      // Paid before shipping: the carrier collects nothing at the door.
      cashToCollect(o.total, o.prepaidAt !== null),
      o.notes,
      o.status,
    ]),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="electrobrothers-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
