import { useMutation, useQueryClient } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";
import type { Lang } from "@/shared/config/roles";

/** Guarda el idioma preferido en la cuenta (`PATCH /auth/me`, I7).
 *
 *  La preferencia vive en el SERVIDOR y no sólo en el navegador: en la sala de
 *  robótica no hay un equipo por estudiante, que es justo el caso en el que un
 *  idioma pegado al dispositivo no sirve de nada.
 *
 *  Vive en `shared/` porque no es de ninguna feature: la cambian tanto la
 *  pantalla de cuenta como el selector de la barra superior de cada panel.
 */
export function useAccountLang() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lang: Lang) =>
      httpClient<unknown>(`${env.apiBaseUrl}/auth/me`, {
        method: "PATCH",
        body: JSON.stringify({ lang }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth", "me"] }),
  });
}
