// Permanent redirects from the old WooCommerce site, so links Google still lists (and their ranking) land on the new pages.
// Products that kept their slug are covered by the generic /product/:slug rule; this table holds only the renamed or
// discontinued ones (discontinued -> their category). Built from import-data/wc-catalog.json.

const PRODUCTS: Record<string, string> = {
  "amazfit-bip-5-smartwatch": "/category/smartwatches",
  "amazfit-gtr-mini-smartwatch-43mm": "/category/smartwatches",
  "amazfit-gts2-mini-smartwatch": "/category/smartwatches",
  "anker-20w-adapter": "/category/chargers",
  "anker-310-usb-c-to-usb-c-cable-3ft-braided": "/category/chargers",
  "anker-322-usb-c-to-lightning-cable-watts-6ft-1-8m": "/category/chargers",
  "anker-333-cable-usb-c-vers-usb-c-100w-3-ft-tresses-noir": "/category/chargers",
  "anker-641-usb-c-to-lightning-cable-flow-3-ft-silicone": "/products/anker-641-usb-c-lightning-flow",
  "anker-charger-25w-usb-c-original": "/category/chargers",
  "anker-charger-30w": "/category/chargers",
  "anker-charger-45w": "/category/chargers",
  "anker-maggo-power-bank-10k": "/category/power-banks",
  "anker-maggo-power-bank-10k-35w-for-apple-watch": "/category/power-banks",
  "anker-power-bank-powercore-20000mah-30w-portable-charger-with-usb-c-cable": "/category/power-banks",
  "anker-usb-c-to-lightning-cable": "/category/chargers",
  "apple-charger-type-c-20w": "/category/chargers",
  "cable-anker-322-powerline-usb-c-vers-lightning-60w": "/category/chargers",
  "cable-usb-c-vers-usb-c-anker-544-240-w": "/category/chargers",
  "car-fast-sharging": "/category/chargers",
  "charger-anker-511-nano-pro-20w": "/category/chargers",
  "chargeur-rapide-20w-t65-cable-usb-type-c-vers-usb-type-c-usams": "/category/chargers",
  "colmi-p73-smartwatch": "/category/smartwatches",
  "dell-latitude-7300-laptop": "/",
  "dt-8-max-smartwatch": "/category/smartwatches",
  "edifier-tws1-pro-earbuds": "/category/headphones",
  "edifier-w220t-earbuds": "/category/headphones",
  "edifier-x3-earbuds": "/category/headphones",
  "haylou-rs4-plus-smartwatch": "/category/smartwatches",
  "haylou-x1-plus": "/category/headphones",
  "hifuture-alfa-speaker": "/category/other-devices",
  "hifuture-flybuds4": "/category/headphones",
  "hifuture-futuretour-x-headphone": "/category/headphones",
  homepod: "/category/other-devices",
  "jbl-wave-beam-earbuds": "/category/headphones",
  "lenovo-gm2-pro": "/category/headphones",
  "lenovo-he05x-ii-generation": "/category/headphones",
  "lenovo-thinkpad-l13-yoga-occasion": "/",
  "lenovo-thinkpad-l14-gen-1-aluminium": "/",
  "lenovo-thinkpad-l14-gen4": "/",
  "lenovo-thinkpad-t14s-16gb": "/",
  "lenovo-thinkpad-t14s-32gb-ram": "/",
  "lenovo-thinkpad-t490-i5-8th-gen-16gb-256ssd-occasion": "/",
  "lenovo-thinkpad-x1-carbon-gen-1": "/",
  "mi-watch-xiaomi-smartwatch": "/category/smartwatches",
  "moxom-20k-mah-powerbank": "/category/power-banks",
  "pack-anker-for-apple-users": "/bundles/pack-for-your-iphone",
  "pack-anker-type-c": "/bundles/pack-for-your-iphone-type-c",
  "picun-w3-earbuds-wireless-5-4-gaming-low-latency": "/category/headphones",
  "powerbank-anker-a1237h11-noir": "/category/power-banks",
  "powercore-26800mah-anker": "/category/power-banks",
  "samsung-akg-usb-type-c-earphones-original": "/category/headphones",
  "soundcore-h30i-headphone-wireless": "/category/headphones",
  "soundcore-k20i-by-anker": "/category/headphones",
  "soundcore-liberty-4-nc-true-wireless-noise-cancelling-earbuds": "/category/headphones",
  "soundcore-r50i": "/products/soundcore-r50i-earbuds",
  "soundcore-r50i-nc": "/products/soundcore-r50i-nc-earbuds-by-anker-c73af8",
  "tronsmart-sounfii-r4-enc-earphones": "/category/headphones",
  "usams-charger-20w-with-cable-type-c-to-lithning": "/category/chargers",
  "veger-20k-powerbank": "/category/power-banks",
  "veger-27k-powerbank": "/category/power-banks",
  "veger-30k-powerbank": "/category/power-banks",
};

const CATEGORIES: Record<string, string> = {
  "audio-electronics": "/category/headphones",
  "charger-powerbank": "/category/chargers",
  smartwatch: "/category/smartwatches",
  "portable-speakers": "/category/other-devices",
  poshettes: "/category/phone-cases",
};

type Redirect = { source: string; destination: string; permanent: true };
const to = (source: string, destination: string): Redirect => ({ source, destination, permanent: true });

/** Order matters: the first matching rule wins, so the specific ones come before the catch-alls. */
export function legacyRedirects(): Redirect[] {
  return [
    ...Object.entries(PRODUCTS).map(([slug, dest]) => to(`/product/${slug}`, dest)),
    to("/product/:slug", "/products/:slug"),
    ...Object.entries(CATEGORIES).flatMap(([slug, dest]) => [to(`/product-category/${slug}`, dest), to(`/product-category/${slug}/:rest*`, dest)]),
    ...["/product-category", "/product-tag", "/product-brand", "/shop", "/home", "/my-account", "/wishlist"].map((p) => to(`${p}/:rest*`, "/")),
  ];
}
