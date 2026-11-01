// One call per shop event, translated to Meta Pixel, GA4 and TikTok Pixel naming.
// Each platform is optional: if its script is not loaded (no ID in .env) the call is a no-op.

export type TrackItem = { id: string; name: string; price: number; quantity: number };

export type TrackEvent =
  | { name: "ViewContent"; items: [TrackItem] }
  | { name: "AddToCart"; items: TrackItem[] }
  | { name: "InitiateCheckout"; items: TrackItem[] }
  | { name: "Purchase"; items: TrackItem[]; orderNumber: string; value: number };

type Fn = (...args: unknown[]) => void;
type PixelWindow = { fbq?: Fn; gtag?: Fn; ttq?: { track: Fn; page: Fn } };

const CURRENCY = "MAD";

const GA4_NAME = { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", Purchase: "purchase" } as const;
// TikTok's standard purchase event is "CompletePayment" (cash collected at the door still counts as the order).
const TIKTOK_NAME = { ViewContent: "ViewContent", AddToCart: "AddToCart", InitiateCheckout: "InitiateCheckout", Purchase: "CompletePayment" } as const;

/** Pure mapping, exported for tests: what each platform receives for one event. */
export function toPlatformCalls(e: TrackEvent) {
  const value = e.name === "Purchase" ? e.value : e.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const ids = e.items.map((i) => i.id);
  // Same event_id on Meta lets a future server-side Conversions API deduplicate.
  const eventId = e.name === "Purchase" ? e.orderNumber : undefined;

  return {
    meta: ["track", e.name, { content_ids: ids, content_type: "product", value, currency: CURRENCY, num_items: e.items.reduce((n, i) => n + i.quantity, 0) }, ...(eventId ? [{ eventID: eventId }] : [])],
    ga4: [
      "event",
      GA4_NAME[e.name],
      {
        currency: CURRENCY,
        value,
        items: e.items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
        ...(e.name === "Purchase" ? { transaction_id: e.orderNumber } : {}),
      },
    ],
    tiktok: [
      TIKTOK_NAME[e.name],
      {
        contents: e.items.map((i) => ({ content_id: i.id, content_name: i.name, price: i.price, quantity: i.quantity })),
        content_type: "product",
        value,
        currency: CURRENCY,
        ...(eventId ? { event_id: eventId } : {}),
      },
    ],
  };
}

export function track(e: TrackEvent) {
  if (typeof window === "undefined") return;
  const w = window as unknown as PixelWindow;
  const calls = toPlatformCalls(e);
  try {
    w.fbq?.(...calls.meta);
    w.gtag?.(...calls.ga4);
    w.ttq?.track(...calls.tiktok);
  } catch {
    // A broken third-party script must never break the shop.
  }
}

/** SPA navigations: GA4 tracks history changes itself; Meta and TikTok need a nudge. */
export function trackPageView() {
  if (typeof window === "undefined") return;
  const w = window as unknown as PixelWindow;
  try {
    w.fbq?.("track", "PageView");
    w.ttq?.page();
  } catch {}
}
