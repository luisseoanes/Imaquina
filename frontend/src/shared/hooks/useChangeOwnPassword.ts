import { useMutation } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { tokens } from "@/shared/api/tokens";
import { env } from "@/shared/config/env";

/** Cambiar la contraseña propia (`POST /auth/me/password`).
 *
 *  El backend devuelve un par de tokens NUEVO —cambiar la contraseña revoca
 *  todos los refresh anteriores— y hay que guardarlo o el siguiente refresco
 *  cierra la sesión de quien acaba de cambiarla.
 */
export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: async (b: { current_password: string; new_password: string }) => {
      const res = await httpClient<{
        access_token: string;
        refresh_token: string;
      }>(`${env.apiBaseUrl}/auth/me/password`, {
        method: "POST",
        body: JSON.stringify(b),
      });
      tokens.set(res);
      return res;
    },
  });
}
