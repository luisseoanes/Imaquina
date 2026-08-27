import type { HTMLAttributes } from "react";

/** Tarjeta base: bordes redondeados + elevación sutil. `interactive` añade el
 *  hover que usan las tarjetas clicables (listados) sin repetirlo en cada
 *  vista. */
export function Card({
  interactive = false,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-sm ${
        interactive ? "transition hover:-translate-y-0.5 hover:shadow-md" : ""
      } ${className}`}
      {...props}
    />
  );
}
