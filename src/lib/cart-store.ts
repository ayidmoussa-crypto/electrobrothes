"use client";

import { useSyncExternalStore } from "react";

// Guest cart in localStorage: only variant ids + quantities. Prices, names and stock are always
// re-read from the server, and the order action re-prices everything again.

export type CartItem = { variantId: string; qty: number };

const KEY = "eb_cart_v1";
const EVENT = "eb-cart-change";
export const MAX_QTY = 10;
const MAX_LINES = 20;
const EMPTY: CartItem[] = [];

function parse(raw: string | null): CartItem[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return EMPTY;
    return data
      .filter((i): i is CartItem => typeof i?.variantId === "string" && Number.isInteger(i?.qty))
      .map((i) => ({ variantId: i.variantId.slice(0, 40), qty: Math.min(Math.max(i.qty, 1), MAX_QTY) }))
      .slice(0, MAX_LINES);
  } catch {
    return EMPTY;
  }
}

function readRaw() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // private mode / blocked storage: behave as an empty cart
  }
}

// useSyncExternalStore needs a stable snapshot: re-parse only when the stored string changes.
let lastRaw: string | null | undefined;
let lastItems = EMPTY;
function snapshot() {
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastItems = parse(raw);
  }
  return lastItems;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb); // other tabs
  window.addEventListener(EVENT, cb); // this tab
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: the cart simply does not persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

export const cart = {
  add(variantId: string, qty = 1) {
    const items = snapshot();
    const existing = items.find((i) => i.variantId === variantId);
    write(
      existing
        ? items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(i.qty + qty, MAX_QTY) } : i))
        : [...items, { variantId, qty: Math.min(qty, MAX_QTY) }].slice(0, MAX_LINES),
    );
  },
  setQty(variantId: string, qty: number) {
    write(snapshot().map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(Math.max(qty, 1), MAX_QTY) } : i)));
  },
  remove(variantId: string) {
    write(snapshot().filter((i) => i.variantId !== variantId));
  },
  clear() {
    write([]);
  },
};

/** Cart items; empty during server render and until hydration. */
export function useCart() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
