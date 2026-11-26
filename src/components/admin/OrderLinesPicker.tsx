"use client";

import { Minus, Plus, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { formatMAD } from "@/lib/money";
import { useAdminTr } from "./AdminLang";
import { inputClass, L } from "./ui";

export type PickVariant = { id: string; productId: string; name: string; label: string | null; colorHex: string | null; sku: string; price: number; stock: number; image: string | null };
export type OrderLine = { variantId: string; qty: number; unitPrice: number };

/**
 * The products of an order being typed in or changed: search, colour, quantity, agreed price, remove.
 * `held`: pieces the order already holds per colour (a confirmed order being changed), usable on top of the stock.
 */
export function OrderLinesPicker({ variants, lines, onChange, held = {} }: { variants: PickVariant[]; lines: OrderLine[]; onChange: (next: OrderLine[]) => void; held?: Record<string, number> }) {
  const { tr, lang } = useAdminTr();
  const mad = (v: number) => formatMAD(v, lang);
  const [query, setQuery] = useState("");
  const free = (v: PickVariant) => v.stock + (held[v.id] ?? 0);

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  // One result per product, whatever its colours: the colour is chosen afterwards, on the order line.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const products = new Map<string, PickVariant[]>();
    for (const v of variants) {
      if (!`${v.name} ${v.label ?? ""} ${v.sku}`.toLowerCase().includes(q)) continue;
      products.set(v.productId, variants.filter((x) => x.productId === v.productId));
    }
    return [...products.values()].slice(0, 8);
  }, [query, variants]);

  // A product goes in with its first colour in stock that is not already in the order (a second tap adds a second colour).
  const nextOf = (group: PickVariant[]) => group.find((v) => free(v) > 0 && !lines.some((l) => l.variantId === v.id));
  const add = (group: PickVariant[]) => {
    const v = nextOf(group);
    if (v) onChange([...lines, { variantId: v.id, qty: 1, unitPrice: v.price }]);
    setQuery("");
  };
  const patch = (id: string, change: Partial<OrderLine>) => onChange(lines.map((l) => (l.variantId === id ? { ...l, ...change } : l)));
  const num = (s: string) => Math.max(0, Math.floor(Number(s) || 0));

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-warm-500" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Enter adds the first match instead of sending a half-filled order.
            e.preventDefault();
            if (results[0] && nextOf(results[0])) add(results[0]);
          }}
          placeholder={tr("ابحث باسم المنتج أو الـ SKU", "Search by product name or SKU")}
          aria-label={tr("ابحث عن منتج", "Search for a product")}
          className={`${inputClass} ps-9`}
        />
        {results.length ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-warm-200 bg-white p-1 shadow-lg shadow-ink/10">
            {results.map((group) => {
              const v = group[0];
              const stock = group.reduce((s, x) => s + x.stock, 0);
              const prices = group.map((x) => x.price);
              const low = Math.min(...prices);
              const colours = group.filter((x) => x.colorHex);
              return (
                <li key={v.productId}>
                  <button
                    type="button"
                    disabled={!nextOf(group)}
                    onClick={() => add(group)}
                    className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-start text-sm hover:bg-warm-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Thumb src={v.image} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{v.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-warm-600">
                        {colours.length ? (
                          <span className="flex -space-x-1 rtl:space-x-reverse" aria-hidden="true">
                            {colours.map((x) => (
                              <Swatch key={x.id} hex={x.colorHex} />
                            ))}
                          </span>
                        ) : null}
                        {colours.length > 1 ? tr(`${colours.length} ألوان · `, `${colours.length} colours · `) : ""}
                        {stock < 1 ? tr("نفد المخزون", "Out of stock") : tr(`بقي ${stock}`, `${stock} left`)}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold text-ink">
                      {Math.max(...prices) > low ? tr("من ", "From ") : ""}
                      {mad(low)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : query.trim() ? (
          <p className="mt-2 text-sm text-warm-600">{tr("ما كاين حتى منتج بهاد الاسم.", "No product with this name.")}</p>
        ) : null}
      </div>

      {lines.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {lines.map((l) => {
            const v = byId.get(l.variantId)!;
            // The other colours of the same product: one tap switches the line to that colour.
            const siblings = variants.filter((s) => s.productId === v.productId && s.colorHex);
            return (
              <li key={l.variantId} className="flex flex-wrap items-center gap-3 border-b border-warm-200 pb-3 last:border-0 last:pb-0">
                <Thumb src={v.image} />
                <span className="min-w-40 flex-1 text-sm">
                  <span className="block font-semibold text-ink">{v.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-warm-600">
                    <Swatch hex={v.colorHex} />
                    {v.label ? `${v.label} · ` : ""}
                    {tr(`بقي ${v.stock}`, `${v.stock} left`)}
                  </span>
                  {siblings.length > 1 ? (
                    <span role="radiogroup" aria-label={tr(`لون ${v.name}`, `Colour of ${v.name}`)} className="mt-1.5 flex flex-wrap gap-1.5">
                      {siblings.map((s) => {
                        const taken = s.id !== v.id && lines.some((x) => x.variantId === s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={s.id === v.id}
                            aria-label={`${s.label ?? ""}${free(s) < 1 ? tr(" (نفد)", " (sold out)") : ""}`}
                            title={`${s.label ?? ""} · ${tr(`بقي ${s.stock}`, `${s.stock} left`)}`}
                            disabled={free(s) < 1 || taken}
                            onClick={() =>
                              onChange(
                                lines.map((x) =>
                                  x.variantId === v.id
                                    ? // A price agreed by hand is kept; the shop price follows the colour.
                                      { variantId: s.id, qty: Math.min(x.qty, free(s)), unitPrice: x.unitPrice === v.price ? s.price : x.unitPrice }
                                    : x,
                                ),
                              )
                            }
                            className={`grid size-8 cursor-pointer place-items-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                              s.id === v.id ? "border-ink" : "border-transparent hover:border-warm-300"
                            }`}
                          >
                            <Swatch hex={s.colorHex} size="size-6" />
                          </button>
                        );
                      })}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1">
                  <button type="button" aria-label={tr("نقّص الكمية", "Decrease quantity")} disabled={l.qty <= 1} onClick={() => patch(l.variantId, { qty: l.qty - 1 })} className={buttonClass({ variant: "outline", size: "icon" })}>
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center font-bold text-ink" aria-live="polite">
                    {l.qty}
                  </span>
                  <button type="button" aria-label={tr("زيد الكمية", "Increase quantity")} disabled={l.qty >= free(v)} onClick={() => patch(l.variantId, { qty: l.qty + 1 })} className={buttonClass({ variant: "outline", size: "icon" })}>
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </span>
                <L label={tr("الثمن", "Price")} className="w-24">
                  <input type="number" min={0} value={l.unitPrice} onChange={(e) => patch(l.variantId, { unitPrice: num(e.target.value) })} className={inputClass} />
                </L>
                <button type="button" aria-label={tr(`حيد ${v.name}`, `Remove ${v.name}`)} onClick={() => onChange(lines.filter((x) => x.variantId !== l.variantId))} className={buttonClass({ variant: "ghost", size: "icon" })}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-warm-600">{tr("ابحث عن منتج وزيدو للطلب.", "Search for a product and add it to the order.")}</p>
      )}
    </>
  );
}

/** The colour's circle (product swatch data); nothing for a product without colours. */
function Swatch({ hex, size = "size-3.5" }: { hex: string | null; size?: string }) {
  return hex ? <span className={`${size} shrink-0 rounded-full border border-warm-300`} style={{ backgroundColor: hex }} aria-hidden="true" /> : null;
}

function Thumb({ src }: { src: string | null }) {
  return <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white">{src ? <Image src={src} alt="" fill sizes="44px" unoptimized className="object-contain p-0.5" /> : null}</span>;
}
