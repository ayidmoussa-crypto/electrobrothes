import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared layout for empty and error states: icon, title, explanation, way forward. */
export function StatePanel({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  role,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  role?: "alert" | "status";
}) {
  return (
    <div role={role} className="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center">
      <span
        className={`grid size-16 place-items-center rounded-full ${tone === "danger" ? "bg-danger-soft text-danger" : "bg-ink text-yellow-500"}`}
      >
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl">{title}</h2>
      {description ? <p className="mt-2 text-warm-600">{description}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
