import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { OrderStatus } from "@/lib/order-rules";
import type { AdminLang } from "@/lib/admin-tr";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "جديد",
  CONFIRMED: "مؤكَّدة",
  CANCELLED: "ملغاة",
  SHIPPING: "جاري الشحن",
  DELIVERED: "مسلَّمة",
  RETURNING: "جاري الإرجاع",
  RETURNED: "أُرجعت بنجاح",
};

export const STATUS_LABEL_EN: Record<OrderStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  SHIPPING: "Shipping",
  DELIVERED: "Delivered",
  RETURNING: "Returning",
  RETURNED: "Returned",
};

export const statusLabel = (s: OrderStatus, lang: AdminLang = "ar") => (lang === "en" ? STATUS_LABEL_EN : STATUS_LABEL)[s];

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  NEW: "accent",
  CONFIRMED: "neutral",
  CANCELLED: "danger",
  SHIPPING: "ink",
  DELIVERED: "success",
  RETURNING: "warning",
  RETURNED: "neutral",
};

export function StatusBadge({ status, lang = "ar" }: { status: OrderStatus; lang?: AdminLang }) {
  return <Badge tone={STATUS_TONE[status]}>{statusLabel(status, lang)}</Badge>;
}

export const RISK_LABEL: Record<string, string> = {
  blacklisted: "في القائمة السوداء",
  bot_honeypot: "روبوت محتمل",
  duplicate_phone: "طلب متكرر بنفس الرقم",
  too_fast: "ملء سريع جداً",
  many_from_ip: "طلبات كثيرة من نفس الجهاز",
  high_value: "قيمة مرتفعة",
};

const RISK_LABEL_EN: Record<string, string> = {
  blacklisted: "On the blacklist",
  bot_honeypot: "Likely a bot",
  duplicate_phone: "Repeat order, same number",
  too_fast: "Form filled very fast",
  many_from_ip: "Many orders from one device",
  high_value: "High value",
};

export const riskLabel = (key: string, lang: AdminLang = "ar") => (lang === "en" ? RISK_LABEL_EN : RISK_LABEL)[key] ?? key;

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-warm-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`admin-card p-4 md:p-5 ${className}`}>
      {title ? <h2 className="mb-3 text-base">{title}</h2> : null}
      {children}
    </section>
  );
}

/** A KPI tile on frosted glass: optional icon (yellow on ink), label, hero number, context line. */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  empty = false,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** No data yet: the value is a sentence, so it is set smaller and muted instead of as a hero number. */
  empty?: boolean;
  /** A result that can be good or bad, such as profit. */
  tone?: "success" | "danger";
}) {
  return (
    <div className="admin-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-warm-600">{label}</p>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-yellow-500">
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className={empty ? "mt-2 text-sm font-semibold text-warm-600" : `mt-1 text-2xl font-extrabold md:text-3xl ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-warm-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass = "min-h-11 w-full admin-field rounded-lg px-3 text-base text-warm-800";

/** Small labelled field for admin row forms. */
export function L({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold text-warm-600 ${className}`}>
      {label}
      {children}
    </label>
  );
}

export const thClass ="px-3 py-2 text-start text-xs font-semibold text-warm-600";
export const tdClass = "px-3 py-2 align-middle text-sm text-warm-800";

/** Feedback line after an admin form action (role=status, success or error tone). */
export function FormMessage({ state }: { state: { ok?: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p role="status" className={`rounded-lg px-3 py-2 text-sm font-medium ${state.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
      {state.message}
    </p>
  );
}
