// Express Relais "AIO" API (docs v1.12): pure helpers plus a small client. No database here.
import type { CarrierStatus } from "./status";

export const ER_HOSTS = {
  sandbox: "https://api-aio-dev.relaisexpress.ma",
  prod: "https://api-aio-prod.relaisexpress.ma",
} as const;
export type ErEnv = keyof typeof ER_HOSTS;

/** +212612345678 or 0612345678 -> 00212612345678 (the format the API wants). Null if it is not a Moroccan mobile. */
export function toErMobile(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "");
  const local = digits.startsWith("00212") ? digits.slice(5) : digits.startsWith("212") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[67]\d{8}$/.test(local) ? `00212${local}` : null;
}

export type ErOrderInput = {
  number: string;
  customerName: string;
  phone: string;
  cityName: string;
  address: string;
  notes: string | null;
  /** Cash to collect at the door, MAD. 0 when the order is already paid. */
  cod: number;
  productName: string;
};

export type ErPickup = { idLocalityPickup?: number; cityPickup: string; addressPickup: string; contactPickup: string; contactPickupPhone: string };
export type ErDefaults = { weightParcel: number; openParcel: "ALLOWED" | "NOT_ALLOWED" };

const cut = (s: string, n: number) => s.trim().slice(0, n);

/** The body of POST /createAioOrder for one order, or the reason it cannot be sent. */
export function buildCreateOrder(
  o: ErOrderInput,
  pickup: ErPickup,
  defaults: ErDefaults,
  opts: { idLocalityDelivery?: number; draft?: boolean },
): { ok: true; body: Record<string, unknown> } | { ok: false; reason: string } {
  const mobile = toErMobile(o.phone);
  if (!mobile) return { ok: false, reason: `phone ${o.phone} is not a Moroccan mobile` };
  if (o.cod > 30000) return { ok: false, reason: `COD ${o.cod} is above the 30000 MAD ceiling` };
  const parts = o.customerName.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;
  if (!firstName) return { ok: false, reason: "customer name is empty" };
  return {
    ok: true,
    body: {
      idParcelClient: o.number,
      pickupType: "ADDRESS",
      ...pickup,
      typeDelivery: "ADDRESS",
      addressDelivery: o.address.trim(),
      cityDelivery: o.cityName,
      ...(opts.idLocalityDelivery ? { idLocalityDelivery: opts.idLocalityDelivery } : {}),
      lastNameRecipient: lastName,
      firstNameRecipient: firstName,
      mobileRecipient: mobile,
      cashOnDelivery: Math.max(0, Math.round(o.cod)),
      weightParcel: defaults.weightParcel,
      openParcel: defaults.openParcel,
      productName: cut(o.productName, 100),
      ...(o.notes ? { commentParcel: cut(o.notes, 100) } : {}),
      draft: opts.draft === true,
    },
  };
}

/** Express Relais status codes -> our 7 steps. Codes not listed (pickup issues, drafts...) change nothing. */
const STATUS_MAP: Record<string, CarrierStatus> = {
  PARCEL_PICKEDUP: "PICKED_UP",
  PARCEL_IN_AGENCY: "IN_TRANSIT",
  PARCEL_IN_TRANSIT: "IN_TRANSIT",
  PARCEL_IN_TRANSPORT: "IN_TRANSIT",
  PARCEL_IN_FINAL_AGENCY: "IN_TRANSIT",
  PARCEL_IN_DELIVERY: "OUT_FOR_DELIVERY",
  SCHEDULED_DELIVERY: "IN_TRANSIT",
  UNREACHABLE_RECIPIENT: "DELIVERY_FAILED",
  UNAVAILABLE_RECIPIENT: "DELIVERY_FAILED",
  WRONG_ADDRESS: "DELIVERY_FAILED",
  PARCEL_REFUSED: "DELIVERY_FAILED",
  COD_REFUSED: "DELIVERY_FAILED",
  PARCEL_CONTENT_ISSUE: "DELIVERY_FAILED",
  DELIVRED_TO_ADDRESS: "DELIVERED",
  PARCEL_RETRIEVED: "DELIVERED",
  PARCEL_TO_RETURN: "RETURNING",
  EPAVE_TO_RETURN: "RETURNING",
  LOCKER_RETURN_IN_PROGRESS: "RETURNING",
  LOCKER_RETURN_PICKED_UP: "RETURNING",
  PARCEL_RETURNED: "RETURNED",
};

/** The parcels a bulk create answered for: reference -> shipment number. Empty when the call did not succeed. */
export function parseBulkCreated(data: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const d = data as { codeApi?: number; data?: { idParcelClient?: unknown; idShipment?: unknown }[] } | null;
  if (d?.codeApi !== 5000 || !Array.isArray(d.data)) return out;
  for (const row of d.data) if (typeof row?.idParcelClient === "string" && row.idShipment != null && row.idShipment !== "") out.set(row.idParcelClient, String(row.idShipment));
  return out;
}

/** The shipment number in a status answer (rows of idOrder), or null. */
export function shipmentFromStatus(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : (data as { data?: unknown[] } | null)?.data?.[0];
  const id = (row as { idOrder?: unknown } | undefined)?.idOrder;
  return id == null || id === "" ? null : String(id);
}

export const mapErStatus = (code: string): CarrierStatus | null => STATUS_MAP[code] ?? null;

/** Result of a call: the API answers 400 with a codeApi for errors. 5000/6000/7000/800 families are success. */
export type ErResult = { ok: boolean; httpStatus: number; data: unknown };

/** A fixed-IP relay in front of Express Relais (ER_RELAY_URL + ER_RELAY_KEY), or undefined to call it directly. */
export function relayFromEnv(e: Record<string, string | undefined> = process.env): ErRelay | undefined {
  const url = e.ER_RELAY_URL?.trim().replace(/\/+$/, "");
  return url && e.ER_RELAY_KEY && url.startsWith("https://") ? { url, key: e.ER_RELAY_KEY } : undefined;
}
export type ErRelay = { url: string; key: string };

/** Keeps a login pass for a while so the next call does not log in again. */
export type TokenStore = { get(key: string): string | null; set(key: string, token: string): void; delete(key: string): void };

/** In this server's memory, 23 hours (the pass lasts 24). Another server instance simply logs in once for itself. */
export function memoryTokenStore(ttlMs = 23 * 60 * 60 * 1000, now: () => number = Date.now): TokenStore {
  const saved = new Map<string, { token: string; until: number }>();
  return {
    get: (key) => {
      const hit = saved.get(key);
      return hit && hit.until > now() ? hit.token : null;
    },
    set: (key, token) => void saved.set(key, { token, until: now() + ttlMs }),
    delete: (key) => void saved.delete(key),
  };
}

export function createErClient(env: ErEnv, login: string, password: string, fetchFn: typeof fetch = fetch, relay: ErRelay | undefined = relayFromEnv(), store?: TokenStore) {
  const host = relay?.url ?? ER_HOSTS[env];
  const storeKey = `${host}|${login}`;
  const relayHeader: Record<string, string> = relay ? { "X-Relay-Key": relay.key } : {};
  let token: string | null = null;

  async function getToken() {
    if (token) return token;
    const kept = store?.get(storeKey);
    if (kept) return (token = kept);
    const res = await fetchFn(`${host}/auth/token`, {
      method: "POST",
      headers: { ...relayHeader, Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}` },
    });
    const data = (await res.json().catch(() => null)) as { token?: string } | null;
    if (!res.ok || !data?.token) throw new Error(`login refused (HTTP ${res.status})`);
    token = data.token;
    store?.set(storeKey, token);
    return token;
  }

  async function call(method: "GET" | "POST", path: string, payload?: Record<string, unknown> | Record<string, unknown>[], retried = false): Promise<ErResult> {
    const usedKept = token !== null || store?.get(storeKey) != null;
    const headers: Record<string, string> = { ...relayHeader, Authorization: `Bearer ${await getToken()}` };
    let url = `${host}${path}`;
    let body: string | undefined;
    if (method === "GET" && payload && !Array.isArray(payload)) url += `?${new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)]))}`;
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(payload ?? {});
    }
    const res = await fetchFn(url, { method, headers, body });
    const data = await res.json().catch(() => null);
    // A kept pass can be expired or revoked: forget it and try once with a fresh one.
    if (!retried && usedKept && !res.ok && (data as { codeApi?: number } | null)?.codeApi === 900) {
      token = null;
      store?.delete(storeKey);
      return call(method, path, payload, true);
    }
    return { ok: res.ok, httpStatus: res.status, data };
  }

  return {
    host,
    info: () => call("GET", "/getInfoClient"),
    localities: () => call("GET", "/getZoneCityDelivery"),
    /** Up to 50 shipments in one request. */
    createMany: (bodies: Record<string, unknown>[]) => call("POST", "/createBulkAioOrder", bodies),
    create: (body: Record<string, unknown>) => call("POST", "/createAioOrder", body),
    confirm: (idParcelClient: string) => call("POST", "/confirmAioOrder", { idParcelClient }),
    cancel: (idParcelClient: string) => call("POST", "/cancelAioOrder", { idParcelClient }),
    /** Latest status of up to ~50 parcels at once (their references). A 5022 answer means none of them exist. */
    statusMany: (idParcelClients: string[]) => call("GET", "/getStatusMultipleParcels", { idParcelClient: idParcelClients.join(",") }),
    status: (idParcelClient: string) => call("GET", "/getStatusParcel", { idParcelClient, exactMatch: 1 }),
  };
}
