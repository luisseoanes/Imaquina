/** Custodia de los tokens de sesión.
 *
 *  Encapsulado a propósito: hoy viven en `localStorage`, y si mañana se pasa a
 *  cookies httpOnly o a memoria, se cambia sólo este fichero. Ningún otro
 *  módulo debe llamar a `localStorage` para esto.
 */
const ACCESS = "access_token";
const REFRESH = "refresh_token";

let access: string | null = localStorage.getItem(ACCESS);
let refresh: string | null = localStorage.getItem(REFRESH);

export const tokens = {
  get access() {
    return access;
  },
  get refresh() {
    return refresh;
  },

  set(pair: { access_token: string; refresh_token?: string }) {
    access = pair.access_token;
    localStorage.setItem(ACCESS, pair.access_token);
    // El backend ROTA el refresh en cada renovación: si viene uno nuevo hay
    // que guardarlo o el siguiente refresco falla con 401.
    if (pair.refresh_token) {
      refresh = pair.refresh_token;
      localStorage.setItem(REFRESH, pair.refresh_token);
    }
  },

  clear() {
    access = null;
    refresh = null;
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};
