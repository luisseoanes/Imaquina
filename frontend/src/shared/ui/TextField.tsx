import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** Icono a la izquierda. Decorativo: el nombre lo da la etiqueta. */
  icon?: ReactNode;
  /** Pista bajo el campo. Va por `aria-describedby`, NO dentro de la etiqueta:
   *  dentro pasaría a formar parte del nombre accesible del campo. */
  hint?: string;
  error?: string;
}

/** Campo de formulario con etiqueta asociada.
 *
 *  La etiqueta se enlaza con `htmlFor`/`id` generados con `useId()`. Un
 *  `placeholder` no sustituye a una etiqueta: desaparece al escribir y deja al
 *  usuario sin saber qué campo está rellenando.
 */
export function TextField({
  label,
  icon,
  hint,
  error,
  type = "text",
  className = "",
  ...props
}: TextFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // Los campos de contraseña llevan conmutador de visibilidad: escribir una
  // contraseña a ciegas en el móvil es la primera causa de fallo al entrar.
  const esPassword = type === "password";
  const [visible, setVisible] = useState(false);
  const tipoReal = esPassword && visible ? "text" : type;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-content">
        {label}
      </label>

      <div className="relative mt-1.5">
        {icon && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-content-subtle"
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          type={tipoReal}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`w-full rounded-control border bg-surface py-3 text-sm text-content
                      transition placeholder:text-content-subtle
                      focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30
                      ${icon ? "pl-11" : "pl-4"} ${esPassword ? "pr-11" : "pr-4"}
                      ${error ? "border-danger" : "border-line"}`}
          {...props}
        />
        {esPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center
                       rounded-r-control text-content-subtle hover:text-content"
          >
            {visible ? <IconoOjoTachado /> : <IconoOjo />}
          </button>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-content-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function IconoOjo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoOjoTachado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.4 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.7A17 17 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 3.4-.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
