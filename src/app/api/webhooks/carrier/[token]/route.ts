import { revalidatePath } from "next/cache";
import { after, type NextRequest } from "next/server";
import { parseCarrierPayload } from "@/lib/carrier/webhook";
import { db } from "@/lib/db";
import { OrderTransitionError } from "@/lib/orders";
import { recordShipmentEvent } from "@/lib/shipments";

// A delivery company pushes parcel updates here. The address itself is the secret (a long random token per
// company, shown in Settings → Delivery companies, and replaceable there).

const MAX_BODY = 200_000;

async function carrierOf(token: string) {
  if (token.length < 20 || token.length > 100) return null;
  return db.carrier.findUnique({ where: { webhookToken: token } });
}

/** Lets the owner or the company check that the address answers. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/webhooks/carrier/[token]">) {
  const carrier = await carrierOf((await params).token);
  return carrier ? Response.json({ ok: true, carrier: carrier.name, active: carrier.isActive }) : new Response("not found", { status: 404 });
}

export async function POST(request: NextRequest, { params }: RouteContext<"/api/webhooks/carrier/[token]">) {
  const carrier = await carrierOf((await params).token);
  if (!carrier) return new Response("not found", { status: 404 });
  if (!carrier.isActive) return new Response("carrier is turned off", { status: 409 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response("too large", { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const events = parseCarrierPayload(body, {
    trackingField: carrier.trackingField,
    statusField: carrier.statusField,
    noteField: carrier.noteField,
    statusMap: (carrier.statusMap ?? {}) as Record<string, string>,
  });
  const actor = `${carrier.name} (API)`;
  const unknown = new Set<string>();
  const problems: string[] = [];
  let applied = 0;

  for (const e of events) {
    if (!e.status) {
      unknown.add(e.raw);
      continue;
    }
    const order = await db.order.findFirst({
      where: { trackingNumber: e.tracking, OR: [{ carrier: carrier.id }, { carrier: null }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, carrierStatus: true },
    });
    if (!order) {
      problems.push(`${e.tracking}|no_order`);
      continue;
    }
    // Carriers often send the same step again: it is logged once.
    if (order.carrierStatus === e.status) continue;
    try {
      await recordShipmentEvent(order.id, e.status, actor, e.note);
      applied++;
    } catch (err) {
      if (!(err instanceof OrderTransitionError)) throw err;
      problems.push(`${e.tracking}|${err.reason}|${e.status}`);
    }
  }

  await db.carrier.update({
    where: { id: carrier.id },
    data: {
      lastEventAt: new Date(),
      // Newest first, ten at most, so the owner can map them on the settings page.
      unknownStatuses: [...unknown, ...carrier.unknownStatuses.filter((s) => !unknown.has(s))].slice(0, 10),
      // "tracking|reason[|status]" lines, worded in the panel's language on the settings page.
      lastError: problems.length ? problems.slice(0, 3).join("\n").slice(0, 500) : null,
    },
  });
  if (applied) {
    revalidatePath("/admin/orders", "layout");
    revalidatePath("/admin");
  }
  revalidatePath("/admin/carriers");

  // A step can start a WhatsApp automation ("out for delivery"): due messages go out after the answer.
  after(async () => {
    const { runDueAutomations } = await import("@/lib/automations");
    await runDueAutomations().catch((e) => console.error("[automations]", e));
  });
  return Response.json({ received: events.length, applied, unknownStatuses: [...unknown], problems });
}
