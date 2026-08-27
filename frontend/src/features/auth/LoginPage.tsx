import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, fieldClass } from "@/components/ui/Field";
import { ApiError } from "@/lib/http";
import { useAuth } from "./useAuth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(
          err.code === "license_expired" ? t("auth.licenseExpired") : t("auth.invalid"),
        );
      } else {
        setServerError(t("common.error"));
      }
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b
                   from-brand/15 to-transparent"
        aria-hidden
      />
      <main className="relative w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 block text-center font-display text-xl font-semibold"
        >
          {t("app.name")}
        </Link>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-lg font-semibold">{t("auth.login")}</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t("auth.email")}>
              <input
                {...register("email")}
                type="email"
                autoComplete="username"
                className={fieldClass}
              />
            </Field>
            <Field label={t("auth.password")}>
              <input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                className={fieldClass}
              />
            </Field>
            {serverError && (
              <p className="flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                <AlertCircle size={16} className="shrink-0" aria-hidden />
                {serverError}
              </p>
            )}
            <Button type="submit" disabled={formState.isSubmitting} className="w-full">
              {t("auth.login")}
              <ArrowRight size={16} aria-hidden />
            </Button>
            {/* No hay recuperación por correo (N15): las cuentas de menores se
                crean sin buzón propio, así que la única vía es el administrador. */}
            <p className="text-center text-xs text-content-subtle">{t("auth.forgot")}</p>
          </form>
        </div>
      </main>
    </div>
  );
}
