"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { Popover, panelHost } from "./Popover";

// The one dropdown of the shop and the admin. It takes the same props and the same <option> / <optgroup> children as
// a native <select>, so a page swaps the tag and nothing else. It submits with its form (hidden field), can be required,
// resets with its form, and works with the keyboard (arrows, Home/End, letters, Enter, Escape).

export type SelectChange = { target: { name: string; value: string }; currentTarget: { name: string; value: string } };

type Option = { value: string; label: ReactNode; text: string; disabled: boolean; group?: string };

const textOf = (node: ReactNode): string => (Array.isArray(node) ? node.map(textOf).join("") : typeof node === "string" || typeof node === "number" ? String(node) : "");

/** Reads <option> and <optgroup> children into a flat list; a group's label is kept on its first option. */
function readOptions(children: ReactNode, group?: string): Option[] {
  const out: Option[] = [];
  let pendingGroup = group;
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const el = child as ReactElement<{ value?: string | number; disabled?: boolean; label?: string; children?: ReactNode }>;
    if (el.type === Fragment) {
      out.push(...readOptions(el.props.children, pendingGroup));
    } else if (el.type === "optgroup") {
      out.push(...readOptions(el.props.children, el.props.label));
    } else if (el.type === "option") {
      const text = textOf(el.props.children);
      out.push({ value: String(el.props.value ?? text), label: el.props.children, text, disabled: !!el.props.disabled, group: pendingGroup });
      pendingGroup = undefined;
    }
  }
  return out;
}

export function Select({
  name,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  id,
  className = "",
  children,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: SelectChange) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** The look of the closed box, e.g. the page's input class. */
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const options = readOptions(children);
  const uid = useId();
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => (defaultValue !== undefined ? String(defaultValue) : (options.find((o) => !o.disabled)?.value ?? "")));
  const current = controlled ? String(value) : inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [host, setHost] = useState<Element | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const initial = useRef(defaultValue !== undefined ? String(defaultValue) : null);

  // Long lists (cities, products...) get a search box; short ones stay a plain list.
  const searchable = options.length > 7;
  const needle = query.trim().toLowerCase();
  const visible = options.map((o, i) => ({ o, i })).filter(({ o }) => !needle || o.text.toLowerCase().includes(needle));

  const selected = options.find((o) => o.value === current);
  const indexOfCurrent = Math.max(0, options.findIndex((o) => o.value === current));

  // A form reset (and React resetting a form after an action) puts the box back to its first value.
  useEffect(() => {
    const form = field.current?.form;
    if (!form || controlled) return;
    const reset = () => setInner(initial.current ?? (readOptions(children).find((o) => !o.disabled)?.value ?? ""));
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  });

  useEffect(() => {
    if (open) document.getElementById(`${uid}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);

  const choose = (o: Option) => {
    if (o.disabled) return;
    setOpen(false);
    button.current?.focus({ preventScroll: true });
    if (o.value === current) return;
    if (!controlled) setInner(o.value);
    onChange?.({ target: { name: name ?? "", value: o.value }, currentTarget: { name: name ?? "", value: o.value } });
  };

  const step = (from: number, dir: 1 | -1) => {
    for (let k = 1; k <= options.length; k++) {
      const i = (from + dir * k + options.length * k) % options.length;
      if (!options[i].disabled) return i;
    }
    return from;
  };

  const show = () => {
    setHost(panelHost(button.current));
    setActive(indexOfCurrent);
    setQuery("");
    setOpen(true);
  };

  const search = (text: string) => {
    setQuery(text);
    const first = options.findIndex((o) => !o.disabled && o.text.toLowerCase().includes(text.trim().toLowerCase()));
    if (first >= 0) setActive(first);
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    const list = visible.filter(({ o }) => !o.disabled).map(({ i }) => i);
    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault();
      if (!list.length) return;
      const at = list.indexOf(active);
      setActive(list[(at + (key === "ArrowDown" ? 1 : -1) + list.length) % list.length]);
    } else if (key === "Enter") {
      e.preventDefault();
      const o = options[active];
      if (o && list.includes(active)) choose(o);
    } else if (key === "Escape" || key === "Tab") {
      if (key === "Escape") e.preventDefault();
      setOpen(false);
      button.current?.focus({ preventScroll: true });
    }
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const key = e.key;
    if (key === "Tab") return setOpen(false);
    if (key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      return setActive((a) => step(a, key === "ArrowDown" ? 1 : -1));
    }
    if (key === "Home" || key === "End") {
      e.preventDefault();
      if (!open) show();
      return setActive(key === "Home" ? step(-1, 1) : step(options.length, -1));
    }
    if (key === "Enter" || key === " ") {
      // A space while typing a search word belongs to the word.
      if (key === " " && open && typed.current.text && Date.now() - typed.current.at < 700) return;
      e.preventDefault();
      return open ? choose(options[active]) : show();
    }
    if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typing letters jumps to the next option that starts with them.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + key.toLowerCase(), at: now };
      const from = open ? active : indexOfCurrent;
      for (let k = 0; k < options.length; k++) {
        const i = (from + k + (typed.current.text.length === 1 ? 1 : 0)) % options.length;
        if (!options[i].disabled && options[i].text.trim().toLowerCase().startsWith(typed.current.text)) {
          if (open) setActive(i);
          else choose(options[i]);
          break;
        }
      }
    }
  };

  const placeholder = selected && (selected.value === "" || selected.disabled);
  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        aria-activedescendant={open ? `${uid}-${active}` : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={`${className} flex cursor-pointer items-center justify-between gap-2 text-start transition-colors hover:border-warm-300 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:text-warm-400`}
      >
        <span className={`min-w-0 flex-1 truncate ${placeholder ? "text-warm-500" : ""}`}>{selected ? selected.label : " "}</span>
        <ChevronDown className={`size-4 shrink-0 text-warm-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {/* What the form sends (when named), and what makes `required` work: a field a browser can focus and mark. */}
      <input ref={field} tabIndex={-1} aria-hidden="true" name={name} value={current} required={required} disabled={disabled} onChange={() => {}} onFocus={() => button.current?.focus()} className="sr-only" />

      <Popover anchor={button} host={host} open={open} onClose={() => setOpen(false)} minWidth={160} estimate={Math.min(options.length, 7) * 40 + 16} className="p-1.5">
        {searchable ? (
          <div className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 mb-1 bg-white p-1.5">
            <label className="relative block">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-warm-500" aria-hidden="true" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => search(e.target.value)}
                onKeyDown={onSearchKey}
                aria-label="Search"
                placeholder="Search…"
                autoComplete="off"
                className="min-h-10 w-full rounded-xl border border-warm-200 bg-warm-50 ps-9 pe-3 text-sm font-semibold text-ink placeholder:text-warm-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
              />
            </label>
          </div>
        ) : null}
        <ul id={`${uid}-list`} role="listbox" aria-label={ariaLabel} className="outline-none">
          {searchable && visible.length === 0 ? <li role="presentation" className="px-3 py-4 text-center text-sm text-warm-500">No results</li> : null}
          {visible.map(({ o, i }) => (
            <li key={`${o.value}-${i}`} role="presentation">
              {o.group ? <p className="px-3 pt-2 pb-1 text-xs font-bold text-warm-500">{o.group}</p> : null}
              <div
                id={`${uid}-${i}`}
                role="option"
                aria-selected={o.value === current}
                aria-disabled={o.disabled || undefined}
                // The box keeps the focus: a press on a choice must not take it away.
                onMouseDown={(e) => e.preventDefault()}
                onPointerEnter={() => !o.disabled && setActive(i)}
                onClick={() => choose(o)}
                className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${
                  o.disabled ? "cursor-not-allowed text-warm-400" : "cursor-pointer text-ink"
                } ${i === active && !o.disabled ? "bg-warm-100" : ""}`}
              >
                <span className="min-w-0 flex-1">{o.label}</span>
                {o.value === current ? <Check className="size-4 shrink-0 text-warm-600" aria-hidden="true" /> : null}
              </div>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}
