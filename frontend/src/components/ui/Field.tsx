import type { ReactNode } from "react";

/** Clase compartida para input/select/textarea -- se aplica directamente al
 *  elemento porque `register()` de react-hook-form necesita ir sobre él. */
export const fieldClass =
  "mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-content " +
  "placeholder:text-content-subtle transition focus:border-brand focus:outline-none " +
  "focus:ring-2 focus:ring-brand/30";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-content">{label}</span>
      {children}
    </label>
  );
}
