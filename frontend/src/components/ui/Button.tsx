import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-content shadow-sm hover:brightness-95",
  secondary: "border border-line bg-surface text-content hover:bg-surface-muted",
  ghost: "text-content-subtle hover:bg-surface-muted hover:text-content",
  danger: "border border-danger/30 text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

/** Mismas clases que `<Button>`, para elementos que no pueden ser un
 *  `<button>` (p. ej. un `<Link>` de react-router que debe verse como CTA). */
export function buttonClasses(variant: Variant = "primary", size: Size = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ variant = "primary", size = "md", className = "", ...props }, ref) => (
  <button
    ref={ref}
    className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    {...props}
  />
));
Button.displayName = "Button";
