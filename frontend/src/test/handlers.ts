import { HttpResponse, http } from "msw";

import { env } from "@/shared/config/env";

export const API = env.apiBaseUrl;

/** Handlers por defecto: sólo lo que dispara la app por su cuenta en casi
 *  cualquier test (el logout es best-effort y sale siempre). Todo lo demás se
 *  declara en el test que lo necesita, para que se vea qué datos asume. */
export const handlers = [
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];
