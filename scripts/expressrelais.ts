// Try the Express Relais API with a few orders. Reads the shop database, never writes to it.
//
//   npm run carrier:er -- check                    login only: shows your account
//   npm run carrier:er -- preview EB-1 EB-2        prints what would be sent, calls nothing
//   npm run carrier:er -- draft EB-1 EB-2          creates DRAFTS at Express Relais: not billed, not picked up
//   npm run carrier:er -- confirm EB-1 EB-2        confirms drafts: billed and sent to operations (REAL)
//   npm run carrier:er -- send EB-1 EB-2           creates and sends at once (REAL)
//   npm run carrier:er -- status EB-1 EB-2         where the parcels are
//   npm run carrier:er -- cancel EB-1              cancels a shipment
//
// Credentials only through the terminal, never a file:
//   ER_ENV=sandbox|prod (default sandbox)  ER_LOGIN=...  ER_PASSWORD=...
// Pickup point (your shop) and parcel defaults:
//   ER_PICKUP_CITY  ER_PICKUP_ADDRESS  ER_PICKUP_CONTACT  ER_PICKUP_PHONE  [ER_PICKUP_LOCALITY_ID]
//   [ER_WEIGHT=1]  [ER_OPEN=ALLOWED|NOT_ALLOWED]
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { erFetch } from "../src/lib/carrier/proxy";
import { buildCreateOrder, createErClient, ER_HOSTS, type ErEnv, type ErOrderInput } from "../src/lib/carrier/expressrelais";

config({ path: [".env.local", ".env"], quiet: true });

const [mode, ...numbers] = process.argv.slice(2);
const MODES = ["check", "preview", "draft", "confirm", "send", "status", "cancel"];
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};
if (!mode || !MODES.includes(mode)) fail(`Usage: npm run carrier:er -- <${MODES.join("|")}> [order numbers]`);
if (mode !== "check" && numbers.length === 0) fail("Give at least one order number.");

const env = (process.env.ER_ENV ?? "sandbox") as ErEnv;
if (!(env in ER_HOSTS)) fail("ER_ENV must be sandbox or prod.");

const need = (name: string) => process.env[name] || fail(`Missing ${name}`);
const login = mode === "preview" ? "" : need("ER_LOGIN");
const password = mode === "preview" ? "" : need("ER_PASSWORD");

const pickup = {
  ...(process.env.ER_PICKUP_LOCALITY_ID ? { idLocalityPickup: Number(process.env.ER_PICKUP_LOCALITY_ID) } : {}),
  cityPickup: process.env.ER_PICKUP_CITY ?? "",
  addressPickup: process.env.ER_PICKUP_ADDRESS ?? "",
  contactPickup: process.env.ER_PICKUP_CONTACT ?? "",
  contactPickupPhone: process.env.ER_PICKUP_PHONE ?? "",
};
if (["preview", "draft", "send"].includes(mode) && (!pickup.cityPickup || !pickup.addressPickup || !pickup.contactPickup || !pickup.contactPickupPhone)) {
  fail("Missing pickup info: set ER_PICKUP_CITY, ER_PICKUP_ADDRESS, ER_PICKUP_CONTACT, ER_PICKUP_PHONE.");
}
const defaults = { weightParcel: Number(process.env.ER_WEIGHT ?? 1), openParcel: process.env.ER_OPEN === "ALLOWED" ? ("ALLOWED" as const) : ("NOT_ALLOWED" as const) };

const show = (label: string, value: unknown) => console.log(`${label}:`, JSON.stringify(value, null, 2));

async function loadOrders(): Promise<ErOrderInput[]> {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const rows = await db.order.findMany({ where: { number: { in: numbers } }, include: { items: true } });
    const missing = numbers.filter((n) => !rows.some((r) => r.number === n));
    if (missing.length) fail(`Orders not found: ${missing.join(", ")}`);
    return numbers.map((n) => {
      const r = rows.find((x) => x.number === n)!;
      const first = r.items[0];
      const count = r.items.reduce((s, i) => s + i.quantity, 0);
      return {
        number: r.number,
        customerName: r.customerName,
        phone: r.phone,
        cityName: r.cityName,
        address: r.address,
        notes: r.notes,
        cod: r.prepaidAt ? 0 : r.total,
        productName: first ? `${first.nameEn}${first.variantLabel ? ` ${first.variantLabel}` : ""}${count > 1 ? ` (+${count - 1})` : ""}` : "Order",
      };
    });
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const client = createErClient(env, login, password, erFetch());
  console.log(`Environment: ${env} (${ER_HOSTS[env]})`);

  if (mode === "check") {
    const r = await client.info();
    const body = Array.isArray(r.data) ? r.data[0] : r.data;
    const d = (body ?? {}) as Record<string, unknown>;
    if (!d.company) console.log("response shape:", Array.isArray(r.data) ? "array" : typeof r.data, Object.keys(d).slice(0, 12));
    // Only what is useful to see; no bank details.
    show("account", { httpStatus: r.httpStatus, company: d.company, status: d.status, billingMode: d.billingMode, billingEngine: d.billingEngine, maxCod: d.maxCod, maxWeight: d.maxWeight, codeApi: d.codeApi, message: d.message });
    return;
  }

  if (mode === "status" || mode === "cancel" || mode === "confirm") {
    for (const n of numbers) {
      const r = mode === "status" ? await client.status(n) : mode === "cancel" ? await client.cancel(n) : await client.confirm(n);
      show(`${mode} ${n} -> HTTP ${r.httpStatus}`, r.data);
    }
    return;
  }

  const orders = await loadOrders();
  // City ids make delivery exact. Without a login (preview) the city name is sent as text.
  let localities: { idLocality: number; name: string }[] = [];
  if (mode !== "preview") {
    const l = await client.localities();
    if (Array.isArray(l.data)) localities = l.data as typeof localities;
  }

  for (const o of orders) {
    const matches = localities.filter((l) => l.name.toLowerCase() === o.cityName.trim().toLowerCase());
    const built = buildCreateOrder(o, pickup, defaults, { idLocalityDelivery: matches.length === 1 ? matches[0].idLocality : undefined, draft: mode !== "send" });
    if (!built.ok) {
      console.log(`${o.number}: SKIPPED, ${built.reason}`);
      continue;
    }
    if (mode === "preview") {
      show(o.number, built.body);
      continue;
    }
    const r = await client.create(built.body);
    show(`${mode} ${o.number} -> HTTP ${r.httpStatus}`, r.data);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
