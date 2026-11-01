"use client";

import { useEffect } from "react";
import { cart } from "@/lib/cart-store";
import { CLEAR_CART_FLAG } from "./OrderForm";

/** Empties the cart after a successful checkout from the cart (not after a quick order from a product page). */
export function ClearCartOnce() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLEAR_CART_FLAG)) {
        sessionStorage.removeItem(CLEAR_CART_FLAG);
        cart.clear();
      }
    } catch {}
  }, []);
  return null;
}
