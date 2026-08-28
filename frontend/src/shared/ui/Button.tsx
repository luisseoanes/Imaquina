import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold " +
  "transition active:scale-[0.99] disabled:pointer-events-none " +
  // El estado deshabilitado se nombra con tokens y no con opacidad: bajar la
  // opacidad del botón entero lo funde con el fondo y deja de leerse cuál es.
  "disabled:bg-surface-muted disabled:text-content-subtle disabled:shadow-none";

const variantes: Record<Variante, string> = {
  primary: "bg-brand text-brand-content shadow-sm hover:bg-brand-strong",
  secondary: "border border-line bg-surface text-content hover:bg-surface-muted",
  ghost: "text-content-muted hover:bg-surface-muted hover:text-content",
};

const tamanos = {
  sm: "px-3 py-2 text-[1.05rem]",
  md: "px-5 py-3.5 text-[1.05rem]",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variante;
  size?: keyof typeof tamanos;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variantes[variant]} ${tamanos[size]} ${className}`}
      {...props}
    />
  );
}
