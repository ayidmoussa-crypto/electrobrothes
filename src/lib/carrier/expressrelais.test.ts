import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCreateOrder, createErClient, mapErStatus, parseBulkCreated, relayFromEnv, shipmentFromStatus, toErMobile } from "./expressrelais";

const pickup = { cityPickup: "CASABLANCA", addressPickup: "12 rue X", contactPickup: "Shop", contactPickupPhone: "0522300900" };
const defaults = { weightParcel: 1, openParcel: "NOT_ALLOWED" as const };
const order = { number: "EB-1", customerName: "Sara El Amrani", phone: "+212612345678", cityName: "Agadir", address: "45 av Hassan II", notes: null, cod: 350, productName: "Phone" };

test("phone formats", () => {
  assert.equal(toErMobile("+212612345678"), "00212612345678");
  assert.equal(toErMobile("0712345678"), "00212712345678");
  assert.equal(toErMobile("00212612345678"), "00212612345678");
  assert.equal(toErMobile("0512345678"), null);
  assert.equal(toErMobile("123"), null);
});

test("builds the order body", () => {
  const r = buildCreateOrder(order, pickup, defaults, { idLocalityDelivery: 3, draft: true });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.body.idParcelClient, "EB-1");
  assert.equal(r.body.mobileRecipient, "00212612345678");
  assert.equal(r.body.firstNameRecipient, "Sara");
  assert.equal(r.body.lastNameRecipient, "El Amrani");
  assert.equal(r.body.cashOnDelivery, 350);
  assert.equal(r.body.idLocalityDelivery, 3);
  assert.equal(r.body.draft, true);
});

test("refuses bad phone, big COD", () => {
  assert.equal(buildCreateOrder({ ...order, phone: "123" }, pickup, defaults, {}).ok, false);
  assert.equal(buildCreateOrder({ ...order, cod: 30001 }, pickup, defaults, {}).ok, false);
});

test("maps statuses", () => {
  assert.equal(mapErStatus("PARCEL_PICKEDUP"), "PICKED_UP");
  assert.equal(mapErStatus("DELIVRED_TO_ADDRESS"), "DELIVERED");
  assert.equal(mapErStatus("PARCEL_RETURNED"), "RETURNED");
  assert.equal(mapErStatus("NEW_ORDER"), null);
});

test("client logs in once and sends the bearer token", async () => {
  const calls: { url: string; auth: string | null }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, auth: new Headers(init.headers).get("Authorization") });
    return new Response(JSON.stringify(url.endsWith("/auth/token") ? { token: "T" } : { codeApi: 5000 }), { status: 200 });
  }) as unknown as typeof fetch;
  const client = createErClient("sandbox", "l", "p", fake);
  await client.info();
  await client.status("EB-1");
  assert.equal(calls.length, 3);
  assert.ok(calls[0].auth?.startsWith("Basic "));
  assert.equal(calls[1].auth, "Bearer T");
  assert.ok(calls[2].url.includes("idParcelClient=EB-1"));
});

test("statusMany sends the references comma separated", async () => {
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(url.endsWith("/auth/token") ? { token: "T" } : []), { status: 200 });
  }) as unknown as typeof fetch;
  await createErClient("sandbox", "l", "p", fake).statusMany(["EB-1", "EB-2"]);
  assert.ok(urls[1].includes("/getStatusMultipleParcels?idParcelClient=EB-1%2CEB-2"));
});

test("through a relay: its address and key are used, and only https relays count", async () => {
  assert.equal(relayFromEnv({ ER_RELAY_URL: "http://1.2.3.4", ER_RELAY_KEY: "k" }), undefined);
  assert.equal(relayFromEnv({ ER_RELAY_URL: "https://r.example/", ER_RELAY_KEY: "" }), undefined);
  const relay = relayFromEnv({ ER_RELAY_URL: "https://r.example/", ER_RELAY_KEY: "secret" });
  assert.deepEqual(relay, { url: "https://r.example", key: "secret" });
  const seen: { url: string; key: string | null }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    seen.push({ url, key: new Headers(init.headers).get("X-Relay-Key") });
    return new Response(JSON.stringify(url.endsWith("/auth/token") ? { token: "T" } : {}), { status: 200 });
  }) as unknown as typeof fetch;
  await createErClient("prod", "l", "p", fake, relay).info();
  assert.ok(seen.every((c) => c.url.startsWith("https://r.example/") && c.key === "secret"));
});

test("no proxy set: plain fetch; a proxy set: a wrapper", async () => {
  const { erFetch } = await import("./proxy");
  assert.equal(erFetch({}), fetch);
  assert.notEqual(erFetch({ FIXIE_URL: "http://user:pass@proxy.example:80" }), fetch);
  assert.notEqual(erFetch({ ER_PROXY_URL: "http://user:pass@proxy.example:80" }), fetch);
});

test("a kept pass is reused, and a refused one is replaced once", async () => {
  const { memoryTokenStore, ER_HOSTS } = await import("./expressrelais");
  const store = memoryTokenStore();
  store.set(`${ER_HOSTS.sandbox}|a`, "OLD"); // a pass kept earlier, since expired
  let logins = 0;
  const seen: string[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/token")) {
      logins++;
      return new Response(JSON.stringify({ token: "NEW" }), { status: 200 });
    }
    const auth = new Headers(init.headers).get("Authorization") ?? "";
    seen.push(auth);
    return auth === "Bearer OLD" ? new Response(JSON.stringify({ codeApi: 900 }), { status: 400 }) : new Response(JSON.stringify([]), { status: 200 });
  }) as unknown as typeof fetch;
  await createErClient("sandbox", "a", "p", fake, undefined, store).info(); // OLD refused, one fresh login, retried
  assert.equal(logins, 1);
  await createErClient("sandbox", "a", "p", fake, undefined, store).info(); // a new client reuses NEW: no login
  assert.equal(logins, 1);
  assert.deepEqual(seen, ["Bearer OLD", "Bearer NEW", "Bearer NEW"]);
});

test("the pass store forgets after its time", async () => {
  const { memoryTokenStore } = await import("./expressrelais");
  let t = 0;
  const store = memoryTokenStore(1000, () => t);
  store.set("k", "tok");
  assert.equal(store.get("k"), "tok");
  t = 1001;
  assert.equal(store.get("k"), null);
});

test("bulk answer: references to shipment numbers, nothing on failure", () => {
  const ok = parseBulkCreated({ codeApi: 5000, data: [{ idParcelClient: "EB-1", idShipment: 111 }, { idParcelClient: "EB-2", idShipment: "222" }] });
  assert.deepEqual([...ok], [["EB-1", "111"], ["EB-2", "222"]]);
  assert.equal(parseBulkCreated({ codeApi: 1005, message: "x" }).size, 0);
  assert.equal(parseBulkCreated(null).size, 0);
});

test("shipment number from a status answer", () => {
  assert.equal(shipmentFromStatus([{ idOrder: 260612381507, status: "NEW_ORDER" }]), "260612381507");
  assert.equal(shipmentFromStatus({ data: [{ idOrder: 5 }] }), "5");
  assert.equal(shipmentFromStatus([]), null);
  assert.equal(shipmentFromStatus({ codeApi: 5022 }), null);
});

test("createMany posts the list in one request", async () => {
  const seen: { url: string; body: string | undefined }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: init.body as string | undefined });
    return new Response(JSON.stringify(url.endsWith("/auth/token") ? { token: "T" } : { codeApi: 5000, data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  await createErClient("sandbox", "l", "p", fake).createMany([{ idParcelClient: "A" }, { idParcelClient: "B" }]);
  const call = seen[1];
  assert.ok(call.url.endsWith("/createBulkAioOrder"));
  assert.deepEqual(JSON.parse(call.body!), [{ idParcelClient: "A" }, { idParcelClient: "B" }]);
});
