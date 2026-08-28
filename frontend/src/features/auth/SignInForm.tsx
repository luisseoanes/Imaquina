import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui/TextField";
import { routes } from "@/shared/config/routes";
import { useAuth } from "@/shared/hooks/useAuth";

const esquema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});
type Campos = z.infer<typeof esquema>;

/** Formulario de acceso.
 *
 *  Sólo correo y contraseña: no hay registro público ni acceso con Google o
 *  Apple. Las cuentas las crea el administrador de la institución (son datos
 *  de menores) y el backend no expone ningún otro camino de entrada, así que
 *  ofrecerlos aquí sería prometer algo que no existe.
 */
export function SignInForm() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<Campos>({
    resolver: zodResolver(esquema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setErrorServidor(null);
    try {
      await login(email, password);
      navigate(routes.dashboard, { replace: true });
    } catch (error) {
      // El backend distingue el caso: una licencia vencida no es culpa de la
      // contraseña, y decir "credenciales inválidas" mandaría al usuario a
      // reintentar algo que ya estaba bien.
      if (error instanceof ApiError) {
        setErrorServidor(
          error.code === "license_expired"
            ? t("auth.licenseExpired")
            : t("auth.invalidCredentials"),
        );
      } else {
        setErrorServidor(t("common.error"));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <TextField
        label={t("auth.email")}
        type="email"
        autoComplete="username"
        placeholder={t("auth.emailPlaceholder")}
        icon={<IconoSobre />}
        {...register("email")}
        {...(formState.errors.email ? { error: t("auth.emailInvalid") } : {})}
      />

      <TextField
        label={t("auth.password")}
        type="password"
        autoComplete="current-password"
        icon={<IconoCandado />}
        {...register("password")}
      />

      {errorServidor && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-control bg-danger-surface px-3 py-2.5 text-sm text-danger"
        >
          <IconoAviso />
          {errorServidor}
        </p>
      )}

      <Button type="submit" disabled={formState.isSubmitting} className="w-full">
        {formState.isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
      </Button>

      {/* No hay recuperación por correo: las cuentas de menores se crean sin
          buzón propio, así que la única vía es el administrador. Decirlo aquí
          evita que alguien busque un enlace que no existe. */}
      <p className="text-center text-xs leading-relaxed text-content-subtle">
        {t("auth.forgotPassword")}
      </p>
    </form>
  );
}

function IconoSobre() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
      <path d="m3.5 7 7.6 5.3a1.6 1.6 0 0 0 1.8 0L20.5 7" strokeLinecap="round" />
    </svg>
  );
}

function IconoCandado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" strokeLinecap="round" />
    </svg>
  );
}

function IconoAviso() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="mt-0.5 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16.2v.2" strokeLinecap="round" />
    </svg>
  );
}
