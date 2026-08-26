import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-bold">{t("app.name")}</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">{t("auth.email")}</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="username"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">{t("auth.password")}</label>
          <input
            {...register("password")}
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        {serverError && <p className="text-sm text-danger">{serverError}</p>}
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="w-full rounded bg-brand px-4 py-2 text-brand-content disabled:opacity-50"
        >
          {t("auth.login")}
        </button>
        {/* No hay recuperación por correo (N15): las cuentas de menores se
            crean sin buzón propio, así que la única vía es el administrador. */}
        <p className="text-center text-xs text-content-subtle">{t("auth.forgot")}</p>
      </form>
    </main>
  );
}
