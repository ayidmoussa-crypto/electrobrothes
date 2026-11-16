import { after } from "next/server";
import { db } from "@/lib/db";
import { clientIp, hit } from "@/lib/guard";
import { campaignEventInput } from "@/lib/offers";

// One click on a home offer or an offer page. Answers at once; the row is written after the response. No IP or
// cookie is stored, only the event, the offer or product and the template.
const MAX_PER_IP_HOUR = 120;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = campaignEventInput.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  const ip = await clientIp();
  after(async () => {
    try {
      if ((await hit(`track:ip:${ip}`, 3600)) > MAX_PER_IP_HOUR) return;
      const e = parsed.data;
      // An unknown offer id (deleted, or made up) is dropped rather than failing on the foreign key.
      const offerId = e.offerId && (await db.offer.findUnique({ where: { id: e.offerId }, select: { id: true } })) ? e.offerId : null;
      await db.campaignEvent.create({ data: { type: e.type, source: e.source, offerId, productId: e.productId ?? null, template: e.template ?? null } });
    } catch (err) {
      console.error("[track]", err);
    }
  });
  return new Response(null, { status: 204 });
}
