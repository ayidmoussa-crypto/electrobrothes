"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CartBundle, CartLine, Upsell } from "@/app/actions/cart";
import { bundleDiscount } from "@/lib/bundles";
import { useCart, type CartItem } from "@/lib/cart-store";

const noop = () => () => {};

/** Browser cart joined with fresh server data. `ready` is false until both are known (no empty-cart flash). */
export function useCartLines() {
  const items = useCart();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const key = items.map((i) => i.variantId).sort().join(",");
  const [data, setData] = useState<{ key: string; lines: CartLine[]; upsell: Upsell[]; bundles: CartBundle[] } | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    // A GET, not the server action: an action fired while a page opens can cancel that navigation.
    fetch(`/api/cart-lines?ids=${encodeURIComponent(key)}`)
      .then((r) => r.json() as Promise<{ lines: CartLine[]; upsell: Upsell[]; bundles: CartBundle[] }>)
      .then((res) => {
        if (!cancelled) setData({ key, ...res });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, hydrated]);

  // Keep showing the previous data while a changed cart is re-fetched (no skeleton flash).
  const ready = hydrated && data !== null;
  const loading = data?.key !== key;
  const byId = new Map((data?.lines ?? []).map((l) => [l.variantId, l]));
  const rows = items.map((i: CartItem) => ({ item: i, line: byId.get(i.variantId) ?? null }));
  return {
    ready,
    loading,
    rows,
    bundles: data?.bundles ?? [],
    upsell: (data?.upsell ?? []).filter((u) => !items.some((i) => i.variantId === u.variantId)),
  };
}

/** The pack saving on these lines, with the names of the packs that gave it (same rule as the order action). */
export function packSaving(lines: { productId: string; price: number; qty: number }[], bundles: CartBundle[], ar: boolean) {
  const r = bundleDiscount(
    lines.map((l) => ({ productId: l.productId, unitPrice: l.price, quantity: l.qty })),
    bundles,
  );
  const names = r.applied.map((a) => {
    const b = bundles.find((x) => x.id === a.bundleId)!;
    return (ar ? b.nameAr : b.nameEn) + (a.times > 1 ? ` ×${a.times}` : "");
  });
  return { discount: r.discount, names };
}
