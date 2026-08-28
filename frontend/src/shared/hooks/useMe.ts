import { useQuery } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";
import type { Lang } from "@/shared/config/roles";

/** La cuenta que ha iniciado sesión (`GET /auth/me`).
 *
 *  Vive en `shared/` porque lo usan varias features (Studio, panel docente):
 *  el nombre y el correo del creador/docente son datos transversales, no de
 *  un feature concreto.
 */
export interface Me {
  id: string;
  email: string;
  full_name: string;
  role: string;
  grade: string | null;
  lang: Lang;
}

export function useMe() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => httpClient<Me>(`${env.apiBaseUrl}/auth/me`),
    staleTime: 5 * 60_000,
  });
}
