"use client";

// A tiny toast store: call toast.error("…") from any client code, and <Toaster /> shows it.
// Kept dependency-free so the toasts wear the brand tokens (globals.css) and nothing else.

export type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: number; kind: ToastKind; message: string };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribeToasts = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const getToasts = () => items;
export const getServerToasts = (): ToastItem[] => [];

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string) {
  const text = message.trim().slice(0, 300);
  if (!text) return;
  // The same message already on screen is not stacked again.
  if (items.some((t) => t.kind === kind && t.message === text)) return;
  // At most four at once: the oldest goes.
  items = [...items, { id: nextId++, kind, message: text }].slice(-4);
  emit();
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};
