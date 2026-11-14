"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/admin";
import { customerSearchTerms, type PastCustomer } from "@/lib/customer-search";
import { db } from "@/lib/db";

/**
 * Past buyers matching what the admin types on a new order (name, phone in any form, city or address), most
 * recent first; with nothing typed, the latest buyers. Agents type orders in too, so staff may search.
 */
export async function searchCustomers(raw: string): Promise<PastCustomer[]> {
  await requireStaff();
  const { text, digits } = customerSearchTerms(typeof raw === "string" ? raw : "");
  const like = `%${text}%`;
  const phoneLike = digits ? `%${digits}%` : null;
  const rows = await db.$queryRaw<(Omit<PastCustomer, "last"> & { last: Date })[]>`
    SELECT o."phone",
      (array_agg(o."customerName" ORDER BY o."createdAt" DESC))[1] AS name,
      (array_agg(o."cityId" ORDER BY o."createdAt" DESC))[1] AS "cityId",
      (array_agg(o."cityName" ORDER BY o."createdAt" DESC))[1] AS city,
      (array_agg(o."address" ORDER BY o."createdAt" DESC))[1] AS address,
      count(*)::int AS orders,
      count(*) FILTER (WHERE o."status" = 'DELIVERED')::int AS delivered,
      count(*) FILTER (WHERE o."status" IN ('RETURNING', 'RETURNED'))::int AS returned,
      COALESCE(sum(o."total") FILTER (WHERE o."status" = 'DELIVERED'), 0)::int AS spent,
      max(o."createdAt") AS last,
      EXISTS (SELECT 1 FROM "Blacklist" b WHERE b."phone" = o."phone") AS blocked
    FROM "Order" o
    GROUP BY o."phone"
    HAVING ${text} = ''
      OR bool_or(o."customerName" ILIKE ${like} OR o."cityName" ILIKE ${like} OR o."address" ILIKE ${like})
      OR (${phoneLike}::text IS NOT NULL AND o."phone" LIKE ${phoneLike}::text)
    ORDER BY last DESC
    LIMIT 8`;
  return rows.map((r) => ({ ...r, last: r.last.toISOString() }));
}

export async function removeSubscriber(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(formData.get("id"));
  if (!id.success) return;
  await db.emailSubscriber.delete({ where: { id: id.data } }).catch(() => null);
  revalidatePath("/admin/customers");
}
