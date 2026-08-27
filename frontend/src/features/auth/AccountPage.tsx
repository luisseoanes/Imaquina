import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { ApiError, http, setAccessToken, setRefreshToken } from "@/lib/http";

const esquema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8),
    repeat_password: z.string().min(8),
  })
  .refine((d) => d.new_password === d.repeat_password, {
    path: ["repeat_password"],
    message: "noMatch",
  });
type Form = z.infer<typeof esquema>;

interface ParDeTokens {
  access_token: string;
  refresh_token: string;
}

/** Cambio de la propia contraseña (N15).
 *
 *  El backend revoca TODOS los refresh del usuario al cambiarla, incluido el
 *  de esta pestaña, y devuelve un par nuevo en la respuesta. Guardarlo no es
 *  opcional: sin esto el siguiente refresco daría 401 y la app echaría al
 *  usuario justo después de acertar su contraseña.
 */
export default function AccountPage() {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState } = useForm<Form>({
    resolver: zodResolver(esquema),
    mode: "onChange",
    defaultValues: { current_password: "", new_password: "", repeat_password: "" },
  });

  const cambiar = useMutation({
    mutationFn: (datos: Form) =>
      http<ParDeTokens>({
        url: "/auth/me/password",
        method: "POST",
        data: {
          current_password: datos.current_password,
          new_password: datos.new_password,
        },
      }),
    onSuccess: (par) => {
      setAccessToken(par.access_token);
      setRefreshToken(par.refresh_token);
      reset();
    },
  });

  return (
    <main className="mx-auto max-w-md p-4 sm:p-6">
      <h1 className="mb-4 text-lg font-semibold">{t("account.title")}</h1>
      <form
        className="grid gap-3 rounded border p-4"
        onSubmit={handleSubmit((datos) => cambiar.mutate(datos))}
      >
        {/* `htmlFor`/`id` explícitos y la pista en `aria-describedby`: metida
            dentro del <label>, el nombre accesible del campo pasaba a ser
            "Contraseña nuevaMínimo 8 caracteres." */}
        <div>
          <label htmlFor="current_password" className="text-sm font-medium">
            {t("account.currentPassword")}
          </label>
          <input
            id="current_password"
            type="password"
            autoComplete="current-password"
            {...register("current_password")}
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label htmlFor="new_password" className="text-sm font-medium">
            {t("account.newPassword")}
          </label>
          <input
            id="new_password"
            type="password"
            autoComplete="new-password"
            aria-describedby="new_password_hint"
            {...register("new_password")}
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
          />
          <p id="new_password_hint" className="text-xs text-content-subtle">
            {t("account.minLength")}
          </p>
        </div>
        <div>
          <label htmlFor="repeat_password" className="text-sm font-medium">
            {t("account.repeatPassword")}
          </label>
          <input
            id="repeat_password"
            type="password"
            autoComplete="new-password"
            {...register("repeat_password")}
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
          />
        </div>

        {formState.errors.repeat_password?.message === "noMatch" && (
          <p className="text-sm text-danger">{t("account.noMatch")}</p>
        )}

        <div>
          <button
            type="submit"
            disabled={cambiar.isPending || !formState.isValid}
            className="rounded bg-brand px-4 py-2 text-sm text-brand-content disabled:opacity-50"
          >
            {t("account.change")}
          </button>
        </div>

        {cambiar.error instanceof ApiError && (
          <p className="text-sm text-danger">{cambiar.error.message}</p>
        )}
        {cambiar.isSuccess && (
          <p className="rounded bg-success px-3 py-2 text-sm text-success-content">
            {t("account.changed")}
          </p>
        )}
      </form>
    </main>
  );
}
