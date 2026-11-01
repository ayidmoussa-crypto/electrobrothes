"use client";

import type { ReactNode } from "react";

/** Native <select> inside the listing GET form: submits on change, plain form submit without JS. */
export function SortSelect({ id, defaultValue, children }: { id: string; defaultValue: string; children: ReactNode }) {
  return (
    <select
      id={id}
      name="sort"
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="min-h-11 cursor-pointer rounded-lg border border-warm-200 bg-white px-3 text-sm font-medium text-ink hover:border-warm-300"
    >
      {children}
    </select>
  );
}
