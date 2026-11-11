import type { NextRequest } from "next/server";
import { getAdmin } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { formatMoroccanPhone } from "@/lib/phone";

/** Every entry of one giveaway as a CSV for Excel (admin only). */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/admin/giveaways/[id]/entries">) {
  if (!(await getAdmin())) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const g = await db.giveaway.findUnique({
    where: { id },
    select: { slug: true, entries: { orderBy: { createdAt: "asc" }, select: { firstName: true, lastName: true, phone: true, marketing: true, winnerRank: true, createdAt: true } } },
  });
  if (!g) return new Response("not found", { status: 404 });
  const rows = [
    ["first_name", "last_name", "phone", "whatsapp_offers", "winner_rank", "entered_at"],
    ...g.entries.map((e) => [e.firstName, e.lastName, formatMoroccanPhone(e.phone), e.marketing ? "yes" : "no", e.winnerRank, e.createdAt.toISOString()]),
  ];
  return new Response(toCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="giveaway-${g.slug}.csv"`, "cache-control": "no-store" },
  });
}
