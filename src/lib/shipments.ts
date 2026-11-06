import "server-only";
import { fireOrderEvent } from "./automations";
import { carrierTransitions, type CarrierStatus } from "./carrier/status";
import { db } from "./db";
import type { OrderStatus } from "./order-rules";
import { changeOrderStatus, OrderTransitionError } from "./orders";

/**
 * One step of a parcel's journey. The same path serves the owner's buttons today and the carrier's API later:
 * it logs the step, moves the order (and so the stock and the automations) when the step calls for it.
 */
export async function recordShipmentEvent(orderId: string, status: CarrierStatus, actor: string, note?: string | null) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) throw new OrderTransitionError("not_found");
  const moves = carrierTransitions(order.status as OrderStatus, status);
  if (moves === null) throw new OrderTransitionError("not_allowed");

  await db.order.update({
    where: { id: orderId },
    data: { carrierStatus: status, events: { create: { status, note: note?.slice(0, 300) || null, actor } } },
  });
  for (const to of moves) await changeOrderStatus(orderId, to, actor, note ?? undefined);

  if (status === "OUT_FOR_DELIVERY") await fireOrderEvent(orderId, "out_for_delivery");
  if (status === "DELIVERY_FAILED") await fireOrderEvent(orderId, "delivery_failed");
}
