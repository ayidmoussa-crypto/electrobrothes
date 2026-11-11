// What a delivery company sends when a parcel moves, read with the fields and status names the owner set for
// that company. Pure, so every shape is tested; the route (app/api/webhooks/carrier) applies the result.
import { isCarrierStatus, type CarrierStatus } from "./status";

export type CarrierFields = { trackingField: string; statusField: string; noteField: string | null; statusMap: Record<string, string> };

export type ParsedEvent =
  | { tracking: string; status: CarrierStatus; note: string | null; raw: string }
  | { tracking: string; status: null; note: string | null; raw: string };

/** "data.parcel.status" in an object; arrays by index ("events.0.status"). */
export function readPath(value: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((v, part) => (v && typeof v === "object" ? (v as Record<string, unknown>)[part] : undefined), value);
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** The carrier's status text, matched without case or extra spaces. */
export const statusKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Turns "their status = our key" rows into a map; rows with an unknown key are dropped. */
export function buildStatusMap(rows: { from: string; to: string }[]) {
  const map: Record<string, CarrierStatus> = {};
  for (const r of rows) if (r.from.trim() && isCarrierStatus(r.to)) map[statusKey(r.from)] = r.to;
  return map;
}

/**
 * One body can hold one event, a list of them, or a list under "events" / "data". Each event needs a tracking
 * number and a status text; a status the owner has not mapped comes back with status null so it can be shown.
 */
export function parseCarrierPayload(body: unknown, f: CarrierFields): ParsedEvent[] {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)
      ? (body as { events: unknown[] }).events
      : body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
        ? (body as { data: unknown[] }).data
        : [body];
  const out: ParsedEvent[] = [];
  for (const item of list.slice(0, 200)) {
    const tracking = text(readPath(item, f.trackingField)).slice(0, 60);
    const raw = text(readPath(item, f.statusField)).slice(0, 80);
    if (!tracking || !raw) continue;
    const mapped = f.statusMap[statusKey(raw)];
    // A carrier that already speaks our keys ("DELIVERED") needs no mapping.
    const status = mapped && isCarrierStatus(mapped) ? mapped : isCarrierStatus(raw.toUpperCase()) ? (raw.toUpperCase() as CarrierStatus) : null;
    const note = f.noteField ? text(readPath(item, f.noteField)).slice(0, 300) || null : null;
    out.push({ tracking, status, note, raw });
  }
  return out;
}

/** The carrier's tracking page for one parcel, or its page as is when it has no "{tracking}" slot. */
export const trackingLink = (template: string | null | undefined, tracking: string | null | undefined) =>
  template ? (tracking && template.includes("{tracking}") ? template.replaceAll("{tracking}", encodeURIComponent(tracking)) : template) : null;
