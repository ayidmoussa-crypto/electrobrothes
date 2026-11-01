import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { OrderStatus } from "@/lib/order-rules";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "جديد",
  CONFIRMED: "مؤكَّد",
  SHIPPING: "قيد الشحن",
  DELIVERED: "مُسلَّم",
  RETURNED: "مُرجَع",
  CANCELLED: "ملغى",
};

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  NEW: "accent",
  CONFIRMED: "neutral",
  SHIPPING: "ink",
  DELIVERED: "success",
  RETURNED: "warning",
  CANCELLED: "danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export const RISK_LABEL: Record<string, string> = {
  blacklisted: "في القائمة السوداء",
  bot_honeypot: "روبوت محتمل",
  duplicate_phone: "طلب متكرر بنفس الرقم",
  too_fast: "ملء سريع جداً",
  many_from_ip: "طلبات كثيرة من نفس الجهاز",
  high_value: "قيمة مرتفعة",
};

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
    <section className={`rounded-xl border border-warm-200 bg-white p-4 ${className}`}>
      {title ? <h2 className="mb-3 text-base">{title}</h2> : null}
      {children}
    </section>
  );
}

/** A KPI tile: label, hero number, optional context line. */
export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-warm-200 bg-white p-4">
      <p className="text-sm text-warm-600">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-warm-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass = "min-h-11 w-full rounded-lg border border-warm-200 bg-warm-100 px-3 text-base text-warm-800 focus:bg-white";

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
