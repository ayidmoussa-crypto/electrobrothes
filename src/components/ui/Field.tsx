import { CircleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Inputs are 48px tall with a 16px font so iOS never zooms on focus.
const control =
  "w-full rounded-lg border bg-warm-100 px-4 text-base text-warm-800 transition-colors placeholder:text-warm-400 hover:border-warm-300 focus:bg-white disabled:cursor-not-allowed disabled:text-warm-400 aria-invalid:border-danger aria-invalid:bg-danger-soft";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true; required?: boolean }) => ReactNode;
};

/** Visible label, hint and error right under the control, wired with aria-describedby. */
export function Field({ id, label, hint, error, required, optionalLabel, children }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {!required && optionalLabel ? <span className="ms-1 font-normal text-warm-500">({optionalLabel})</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-warm-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-sm font-medium text-danger">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${control} min-h-12 border-warm-200 ${className}`} />;
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={`${control} min-h-12 cursor-pointer border-warm-200 ${className}`}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${control} min-h-24 border-warm-200 py-3 ${className}`} />;
}
