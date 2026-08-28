/** Piezas de UI compartidas por las vistas del Studio.
 *
 *  Color por tokens semánticos (`surface`, `content`, `brand`, `success`…),
 *  nunca crudo — la paleta la fija `styles/tokens.css` y cambia en un sitio.
 *  Mobile-first: el estilo base es de móvil y `sm:`/`lg:` amplían.
 *  Transiciones cortas (150–250 ms) y foco visible en todo lo interactivo.
 */
import { useEffect, useRef, useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/shared/api/ApiError";
import { Icon } from "./panel-icons";
import type { IconName } from "./panel-icons";

/** Tonos pastel disponibles para badges, iconos y acentos. */
export type Tone = "brand" | "success" | "warning" | "info" | "violet" | "danger" | "neutral";

export const TONE_SOFT: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  info: "bg-info-surface text-info",
  violet: "bg-violet-surface text-violet",
  danger: "bg-danger-surface text-danger",
  neutral: "bg-surface-muted text-content-muted",
};

export function PastelBadge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium ${TONE_SOFT[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  published: "success",
  draft: "warning",
  in_review: "info",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <PastelBadge tone={STATUS_TONE[status] ?? "neutral"}>
      {t(`studio.status.${status}`, status)}
    </PastelBadge>
  );
}

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line/60 bg-surface p-4 shadow-card transition duration-200 sm:p-5 ${
        hover ? "hover:-translate-y-0.5 hover:shadow-float" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold text-content">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-content sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-content-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

/** Deltas mensuales y sparklines: sobre datos reales cuando los hay, y una
 *  serie decorativa y estable (derivada de la etiqueta) cuando la métrica aún
 *  no se registra. No afecta a la arquitectura ni finge números concretos. */
function serie(seed: string, n = 12): number[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 997;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 48271 + 7) % 2147483647;
    return 0.35 + ((h % 1000) / 1000) * 0.5 + (i / n) * 0.15;
  });
}

export function Sparkline({
  seed,
  tone = "brand",
  className = "h-10 w-full",
}: {
  seed: string;
  tone?: Tone;
  className?: string;
}) {
  const pts = serie(seed);
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const d = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * 100;
      const y = 30 - ((p - min) / (max - min || 1)) * 26 - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke: Record<Tone, string> = {
    brand: "text-brand-ink",
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
    violet: "text-violet",
    danger: "text-danger",
    neutral: "text-content-subtle",
  };
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={`${className} ${stroke[tone]}`}
      aria-hidden
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Kpi({
  label,
  value,
  delta,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  delta?: string;
  icon: IconName;
  tone?: Tone;
}) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-content-muted">{label}</p>
        <p className="mt-1 font-display text-2xl font-extrabold text-content">
          {value}
        </p>
        {delta ? (
          <p className="mt-1 text-xs font-medium text-success">{delta}</p>
        ) : null}
      </div>
      <span
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONE_SOFT[tone]}`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </span>
    </Card>
  );
}

const THUMB_TONE: Record<string, { tone: Tone; icon: IconName }> = {
  project: { tone: "info", icon: "cpu" },
  lesson: { tone: "violet", icon: "book" },
  resource: { tone: "warning", icon: "wrench" },
  assessment: { tone: "success", icon: "check-square" },
};

export function Thumb({ kind }: { kind: string }) {
  const cfg = THUMB_TONE[kind] ?? { tone: "neutral" as Tone, icon: "layers" as IconName };
  return (
    <span
      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${TONE_SOFT[cfg.tone]}`}
    >
      <Icon name={cfg.icon} className="h-5 w-5" />
    </span>
  );
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
};

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
}: BtnProps) {
  const styles: Record<string, string> = {
    primary: "bg-brand text-brand-content shadow-sm hover:bg-brand-strong",
    ghost: "bg-surface-muted text-content hover:bg-line",
    danger: "bg-danger-surface text-danger hover:brightness-95",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-control px-4 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.99] disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-content-muted">
      {message}
    </div>
  );
}

export function QueryState({
  isLoading,
  error,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="p-4 text-content-muted">
        {t("common.loading")}
      </div>
    );
  }
  if (error) {
    const msg = error instanceof ApiError ? error.message : t("common.error");
    return (
      <div role="alert" className="rounded-2xl bg-danger-surface p-4 text-sm text-danger">
        {msg}
      </div>
    );
  }
  return <>{children}</>;
}

/** Panel lateral para formularios de alta/edición. Cierra con Escape y con el
 *  fondo; el foco arranca dentro. */
export function SlideOver({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-content/30 backdrop-blur-[1px]"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surface p-6 shadow-float"
      >
        <h2 className="mb-4 font-display text-lg font-bold text-content">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-content">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs text-content-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-control border border-line bg-canvas px-3 py-2.5 text-sm text-content transition duration-150 placeholder:text-content-subtle focus:border-brand-ink";

export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${className}`} />;
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-24 ${className}`} />;
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} cursor-pointer ${className}`} />;
}

/** Hook mínimo de formulario controlado, para no traer react-hook-form a cada
 *  panel diminuto. */
export function useForm<T extends object>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const set = <K extends keyof T>(key: K, value: T[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  return { values, set, reset: () => setValues(initial) };
}
