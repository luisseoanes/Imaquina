/** Handlers por defecto de MSW. Un test puede sobrescribirlos con
 *  `server.use(...)` para el caso que le interese. */
import { HttpResponse, http } from "msw";

export const API = "/api/v1";

export const handlers = [
  http.post(`${API}/auth/login`, () =>
    HttpResponse.json({
      access_token: "token-de-acceso",
      refresh_token: "token-de-refresco",
      token_type: "bearer",
      role: "teacher",
      lang: "es",
    }),
  ),
  // N2: el logout revoca en el servidor. Mockeado por defecto porque
  // `AuthProvider.logout()` lo dispara siempre, best-effort, aunque el test
  // no esté probando logout en sí.
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];
