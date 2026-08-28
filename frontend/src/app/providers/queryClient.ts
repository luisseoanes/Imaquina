import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/shared/api/ApiError";

/** Cliente de TanStack Query con la política de reintentos de este proyecto.
 *
 *  El `retry` por defecto reintenta 3 veces cualquier fallo, incluidos los que
 *  no se arreglan solos: un 403 o un 404 reintentado tres veces sólo retrasa
 *  el mensaje de error y multiplica la carga sobre el backend.
 */
export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (intentos, error) => {
          // 5xx puede ser transitorio; 4xx no se va a arreglar reintentando.
          if (error instanceof ApiError && error.status < 500) return false;
          return intentos < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
