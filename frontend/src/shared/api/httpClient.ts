import { ApiError } from "./ApiError";
import { tokens } from "./tokens";

/** Cliente HTTP único de la aplicación.
 *
 *  Es el `mutator` del código generado desde el OpenAPI, así que la
 *  autenticación, la renovación del token y la traducción de errores ocurren
 *  en UN solo sitio para los 69 endpoints. Su firma es la de `fetch`
 *  —`(url, init)`— porque es la que emite orval; la URL ya viene con el
 *  prefijo `/api/v1` desde el generado.
 *
 *  Lo que resuelve y no es obvio:
 *
 *  - **Una sola renovación en vuelo.** Si varias peticiones reciben 401 a la
 *    vez, se renueva una vez y todas esperan a esa misma promesa. Sin esto se
 *    dispararían varios refrescos y, como el backend ROTA el refresh token,
 *    todos menos el primero llegarían con un jti ya consumido: el servidor los
 *    trata como robo y la sesión se cierra sola.
 *  - **No se reintenta en las rutas de auth**, o un login con contraseña
 *    equivocada entraría en bucle de renovación.
 *  - **Un 403 no cierra la sesión.** 401 es "no sabemos quién eres" (renovar);
 *    403 es "sabemos quién eres y esto no te toca" — un docente entrando a algo
 *    de editor. Confundirlos echa de la aplicación a quien sí tiene sesión.
 */
const SIN_REINTENTO = ["/auth/login", "/auth/refresh", "/auth/logout"];

let renovacionEnVuelo: Promise<boolean> | null = null;

async function renovarAcceso(): Promise<boolean> {
  if (!tokens.refresh) return false;

  renovacionEnVuelo ??= (async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refresh }),
      });
      if (!res.ok) return false;
      tokens.set(await res.json());
      return true;
    } catch {
      return false;
    } finally {
      renovacionEnVuelo = null;
    }
  })();

  return renovacionEnVuelo;
}

export async function httpClient<T>(
  url: string,
  init?: RequestInit,
  esReintento = false,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    if (
      res.status === 401 &&
      !esReintento &&
      !SIN_REINTENTO.some((ruta) => url.includes(ruta))
    ) {
      if (await renovarAcceso()) return httpClient<T>(url, init, true);
      tokens.clear();
    }

    const cuerpo = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      res.status,
      cuerpo.error?.code ?? "unknown",
      cuerpo.error?.message ?? res.statusText,
    );
  }

  // 204 No Content: no hay cuerpo que parsear.
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export default httpClient;
