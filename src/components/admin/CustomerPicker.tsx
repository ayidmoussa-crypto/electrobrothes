"use client";

import { Ban, LoaderCircle, Search, ShoppingBag, Undo2, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchCustomers } from "@/app/actions/admin-customers";
import { initials, type PastCustomer } from "@/lib/customer-search";
import { formatMAD } from "@/lib/money";
import { formatMoroccanPhone } from "@/lib/phone";
import { useAdminTr } from "./AdminLang";

const showPhone = (p: string) => (p.startsWith("+212") ? formatMoroccanPhone(p) : p);

/**
 * "Who is it?" at the top of a new order: search past buyers by name, phone (any way it is typed), city or address,
 * see at a glance how they bought (orders, money spent, returns, blacklist), and one tap fills the customer fields.
 * Focusing the empty box lists the latest buyers. A new customer is simply typed in the fields below.
 */
export function CustomerPicker({ picked, onPick, onClear }: { picked: PastCustomer | null; onPick: (c: PastCustomer) => void; onClear: () => void }) {
  const { tr, lang } = useAdminTr();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PastCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // Typed text is looked up a moment after the last key, and only the latest answer is kept.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const t = setTimeout(() => {
      setLoading(true);
      searchCustomers(query)
        .then((r) => {
          if (!live) return;
          setResults(r);
          setActive(0);
        })
        .catch(() => live && setResults([]))
        .finally(() => live && setLoading(false));
    }, query ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pick = (c: PastCustomer) => {
    onPick(c);
    setOpen(false);
    setQuery("");
  };

  if (picked) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-yellow-300 bg-yellow-50 p-3">
        <Badge c={picked} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{picked.name}</p>
          <p className="truncate text-sm text-warm-700">
            <span dir="ltr" className="inline-block">
              {showPhone(picked.phone)}
            </span>{" "}
            · {picked.city}
          </p>
          <Facts c={picked} tr={tr} lang={lang} />
        </div>
        <button type="button" onClick={onClear} className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-warm-800 hover:bg-white">
          <X className="size-4" aria-hidden="true" />
          {tr("بدّل", "Change")}
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-warm-500" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (!results.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
          } else if (e.key === "Enter") {
            // Enter picks the highlighted buyer instead of sending a half-filled order.
            e.preventDefault();
            pick(results[active]);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls="customer-results"
        aria-label={tr("ابحث على زبون شرا من عندك", "Search a past customer")}
        placeholder={tr("زبون قديم؟ الاسم، الهاتف ولا المدينة", "Past customer? Name, phone or city")}
        className="min-h-12 w-full rounded-2xl border-2 border-dashed border-warm-300 bg-white ps-10 pe-10 text-sm text-ink placeholder:text-warm-500 focus:border-solid focus:border-yellow-500 focus:outline-none"
      />
      {loading ? <LoaderCircle className="absolute end-3.5 top-1/2 size-4.5 -translate-y-1/2 animate-spin text-warm-500" aria-hidden="true" /> : null}

      {open ? (
        <div id="customer-results" role="listbox" aria-label={tr("الزبناء", "Customers")} className="animate-pop absolute inset-x-0 top-full z-30 mt-2 max-h-[min(26rem,60dvh)] origin-top overflow-y-auto rounded-2xl border border-warm-200 bg-white p-1.5 shadow-xl shadow-ink/15">
          <p className="px-2.5 pt-1.5 pb-1 text-xs font-bold text-warm-600">{query.trim() ? tr("اللي لقينا", "Matches") : tr("آخر الزبناء", "Latest customers")}</p>
          {results.map((c, i) => (
            <button
              key={c.phone}
              type="button"
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(c)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-start ${i === active ? "bg-warm-100" : ""}`}
            >
              <Badge c={c} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-bold text-ink">{c.name}</span>
                  <span className="shrink-0 text-xs text-warm-600" dir="ltr">
                    {showPhone(c.phone)}
                  </span>
                </span>
                <span className="block truncate text-xs text-warm-600">
                  {c.city}
                  {c.address ? ` · ${c.address}` : ""}
                </span>
                <Facts c={c} tr={tr} lang={lang} />
              </span>
            </button>
          ))}
          {!loading && !results.length ? (
            <p className="flex items-center gap-2 px-2.5 py-4 text-sm text-warm-600">
              <UserRound className="size-4.5" aria-hidden="true" />
              {tr("ما لقينا حتى زبون. عمّر المعلومات تحت كزبون جديد.", "No customer found. Fill in the fields below as a new customer.")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Round initials: yellow for a buyer who received at least one order, warm grey otherwise. */
function Badge({ c }: { c: PastCustomer }) {
  return (
    <span className={`grid size-11 shrink-0 place-items-center rounded-full text-sm font-extrabold ${c.blocked ? "bg-danger-soft text-danger" : c.delivered ? "bg-yellow-500 text-ink" : "bg-warm-200 text-warm-800"}`} aria-hidden="true">
      {initials(c.name)}
    </span>
  );
}

/** How this buyer bought, in small chips. */
function Facts({ c, tr, lang }: { c: PastCustomer; tr: (ar: string, en: string) => string; lang: "ar" | "en" }) {
  const chip = "inline-flex items-center gap-1 rounded-full px-2 text-[11px] leading-5 font-semibold";
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      <span className={`${chip} bg-warm-100 text-warm-800`}>
        <ShoppingBag className="size-3" aria-hidden="true" />
        {tr(`${c.orders} طلب`, `${c.orders} ${c.orders === 1 ? "order" : "orders"}`)}
      </span>
      {c.spent ? <span className={`${chip} bg-success-soft text-success`}>{tr(`شرا بـ ${formatMAD(c.spent, lang)}`, `${formatMAD(c.spent, lang)} spent`)}</span> : null}
      {c.returned ? (
        <span className={`${chip} bg-danger-soft text-danger`}>
          <Undo2 className="size-3" aria-hidden="true" />
          {tr(`رجّع ${c.returned}`, `${c.returned} returned`)}
        </span>
      ) : null}
      {c.blocked ? (
        <span className={`${chip} bg-danger-soft text-danger`}>
          <Ban className="size-3" aria-hidden="true" />
          {tr("فالقائمة السوداء", "Blacklisted")}
        </span>
      ) : null}
    </span>
  );
}
