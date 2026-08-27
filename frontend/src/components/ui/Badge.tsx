import type { HTMLAttributes } from "react";

type Tone = "neutral" | "brand" | "success" | "danger" | "note";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-content-muted",
  brand: "bg-brand text-brand-content",
  success: "bg-success text-success-content",
  danger: "bg-danger/10 text-danger",
  note: "bg-note text-note-content",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
