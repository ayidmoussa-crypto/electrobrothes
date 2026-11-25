import "server-only";
import { db } from "../db";
import { OrderTransitionError } from "../orders";
import { recordShipmentEvent } from "../shipments";
import { erFetch } from "./proxy";
import { cacheLife, cacheTag } from "next/cache";
import { buildCreateOrder, createErClient, ER_HOSTS, mapErStatus, memoryTokenStore, parseBulkCreated, shipmentFromStatus, type ErEnv, type ErOrderInput } from "./expressrelais";
import { decryptCredentials } from "./secrets";

/** Which Express Relais space a carrier's API address points to. Any other address is not trusted with the password. */
export const erEnvOf = (apiBaseUrl: string | null | undefined): ErEnv | null => {
  const url = (apiBaseUrl ?? "").trim().replace(/\/+$/, "");
  return (Object.keys(ER_HOSTS) as ErEnv[]).find((e) => ER_HOSTS[e] === url) ?? null;
};

// One login pass per server instance, reused for 23 hours.
const tokenStore = memoryTokenStore();

/**
 * Express Relais's delivery cities (id and name), remembered for a day across all servers. A failed call is not
 * remembered: it throws, and the next send asks again.
 */
async function erLocalities(carrierId: string): Promise<{ idLocality: number; name: string }[]> {
  "use cache";
  cacheLife("days");
  cacheTag("er-localities");
  const carrier = await db.carrier.findUnique({ where: { id: carrierId }, select: { apiBaseUrl: true, credentials: true } });
  const env = erEnvOf(carrier?.apiBaseUrl);
  const creds = decryptCredentials(carrier?.credentials);
  if (!env || !creds?.login || !creds.password) throw new Error("not connected");
  const r = await createErClient(env, creds.login, creds.password, erFetch(), undefined, tokenStore).localities();
  if (!Array.isArray(r.data)) throw new Error(`city list unavailable (HTTP ${r.httpStatus})`);
  return (r.data as { idLocality: number; name: string }[]).map((l) => ({ idLocality: l.idLocality, name: l.name }));
}

export type SendOutcome = { ok: true; tracking: string; draft?: boolean } | { ok: false; reason: string };

/**
 * Sends orders to Express Relais, one by one. The pickup point comes from ER_PICKUP_* in the environment.
 * ER_DRAFT=1 creates drafts instead: not billed, not picked up (for a first try).
 */
export async function sendToExpressRelais(carrier: { id: string; apiBaseUrl: string | null; credentials: string | null }, orders: ErOrderInput[]): Promise<Map<string, SendOutcome>> {
  const out = new Map<string, SendOutcome>();
  const failAll = (reason: string) => {
    for (const o of orders) out.set(o.number, { ok: false, reason });
    return out;
  };
  const env = erEnvOf(carrier.apiBaseUrl);
  if (!env) return failAll("API address is not an Express Relais one");
  const creds = decryptCredentials(carrier.credentials);
  if (!creds?.login || !creds.password) return failAll("login and password are not saved for this company");
  const e = process.env;
  if (!e.ER_PICKUP_CITY || !e.ER_PICKUP_ADDRESS || !e.ER_PICKUP_CONTACT || !e.ER_PICKUP_PHONE) return failAll("pickup point is not set (ER_PICKUP_* settings)");
  const pickup = {
    ...(e.ER_PICKUP_LOCALITY_ID ? { idLocalityPickup: Number(e.ER_PICKUP_LOCALITY_ID) } : {}),
    cityPickup: e.ER_PICKUP_CITY,
    addressPickup: e.ER_PICKUP_ADDRESS,
    contactPickup: e.ER_PICKUP_CONTACT,
    contactPickupPhone: e.ER_PICKUP_PHONE,
  };
  const defaults = { weightParcel: Number(e.ER_WEIGHT ?? 1) || 1, openParcel: e.ER_OPEN === "ALLOWED" ? ("ALLOWED" as const) : ("NOT_ALLOWED" as const) };

  const client = createErClient(env, creds.login, creds.password, erFetch(), undefined, tokenStore);
  let localities: { idLocality: number; name: string }[] = [];
  try {
    localities = await erLocalities(carrier.id);
  } catch (err) {
    return failAll(err instanceof Error ? err.message : "Express Relais is not reachable");
  }

  const draft = e.ER_DRAFT === "1";
  const bodies = new Map<string, Record<string, unknown>>();
  for (const o of orders) {
    const matches = localities.filter((l) => l.name.toLowerCase() === o.cityName.trim().toLowerCase());
    const built = buildCreateOrder(o, pickup, defaults, { idLocalityDelivery: matches.length === 1 ? matches[0].idLocality : undefined, draft });
    if (built.ok) bodies.set(o.number, built.body);
    else out.set(o.number, { ok: false, reason: built.reason });
  }

  // Two or more orders go in one request. If that call fails, nothing is assumed: each order is then sent on its own.
  const numbers = [...bodies.keys()];
  if (numbers.length >= 2) {
    for (let i = 0; i < numbers.length; i += 50) {
      const chunk = numbers.slice(i, i + 50);
      try {
        const r = await client.createMany(chunk.map((n) => bodies.get(n)!));
        for (const [n, tracking] of parseBulkCreated(r.data)) if (bodies.has(n)) out.set(n, { ok: true, tracking, draft });
      } catch {
        // falls through to one by one
      }
    }
  }

  for (const n of numbers) {
    if (out.has(n)) continue;
    try {
      const r = await client.create(bodies.get(n)!);
      const d = (r.data ?? {}) as { codeApi?: number; message?: string; idShipment?: number | string };
      if (d.codeApi === 5000 && d.idShipment) {
        out.set(n, { ok: true, tracking: String(d.idShipment), draft });
      } else if (d.codeApi === 5021) {
        // The reference already exists there (an earlier try, or part of a failed bulk): take its shipment number.
        const known = shipmentFromStatus((await client.status(n)).data);
        out.set(n, known ? { ok: true, tracking: known, draft } : { ok: false, reason: `5021: ${d.message ?? "already exists"}` });
      } else {
        out.set(n, { ok: false, reason: `${d.codeApi ?? r.httpStatus}: ${d.message ?? "refused"}` });
      }
    } catch (err) {
      out.set(n, { ok: false, reason: err instanceof Error ? err.message : "request failed" });
    }
  }
  return out;
}

export type SyncSummary = { checked: number; updated: number; problems: string[] };

/**
 * Asks Express Relais where each open parcel is, and moves the orders (and stock) accordingly. Used instead of a
 * webhook, which the account already points elsewhere. Safe to repeat: a step already recorded is skipped.
 */
export async function syncExpressRelais(carrier: { id: string; name: string; apiBaseUrl: string | null; credentials: string | null }): Promise<SyncSummary> {
  const summary: SyncSummary = { checked: 0, updated: 0, problems: [] };
  const env = erEnvOf(carrier.apiBaseUrl);
  const creds = decryptCredentials(carrier.credentials);
  if (!env || !creds?.login || !creds.password) return { ...summary, problems: ["not connected"] };

  const orders = await db.order.findMany({
    where: { carrier: carrier.id, trackingNumber: { not: null }, status: { in: ["CONFIRMED", "SHIPPING", "RETURNING"] } },
    select: { id: true, number: true, carrierStatus: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const client = createErClient(env, creds.login, creds.password, erFetch(), undefined, tokenStore);
  const actor = `${carrier.name} (API)`;

  for (let i = 0; i < orders.length; i += 40) {
    const batch = orders.slice(i, i + 40);
    let rows: { idParcelClient?: string; status?: string }[] = [];
    try {
      const r = await client.statusMany(batch.map((o) => o.number));
      if (Array.isArray(r.data)) rows = r.data as typeof rows;
      else if ((r.data as { codeApi?: number } | null)?.codeApi !== 5022) {
        summary.problems.push(`HTTP ${r.httpStatus}: ${(r.data as { message?: string } | null)?.message ?? "refused"}`);
        continue;
      }
    } catch (err) {
      summary.problems.push(err instanceof Error ? err.message : "request failed");
      continue;
    }
    summary.checked += batch.length;
    for (const o of batch) {
      const code = rows.find((r) => r.idParcelClient === o.number)?.status;
      const mapped = code ? mapErStatus(code) : null;
      if (!mapped || mapped === o.carrierStatus) continue;
      try {
        await recordShipmentEvent(o.id, mapped, actor, null);
        summary.updated++;
      } catch (err) {
        if (!(err instanceof OrderTransitionError)) throw err;
        summary.problems.push(`${o.number}: ${err.reason} (${mapped})`);
      }
    }
  }
  return summary;
}
