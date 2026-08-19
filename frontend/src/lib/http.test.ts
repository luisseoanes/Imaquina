/** El cliente HTTP traduce el sobre de error del backend y limpia el token
 *  cuando el servidor dice que ya no vale. Las dos cosas son contrato con
 *  `app/core/errors.py`, no detalle interno. */
import { HttpResponse, http as mswHttp } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/setup";
import { API } from "@/test/handlers";
import {
  ApiError,
  clearTokens,
  http,
  setAccessToken,
  setRefreshToken,
} from "./http";

describe("http", () => {
  it("traduce el sobre {error:{code,message}} del backend a ApiError", async () => {
    server.use(
      mswHttp.get(`${API}/learn/projects`, () =>
        HttpResponse.json(
          { error: { code: "license_expired", message: "Licencia vencida" } },
          { status: 403 },
        ),
      ),
    );

    const fallo = await http({ url: "/learn/projects" }).catch((e: unknown) => e);

    expect(fallo).toBeInstanceOf(ApiError);
    expect(fallo).toMatchObject({
      status: 403,
      code: "license_expired",
      message: "Licencia vencida",
    });
  });

  it("un 403 NO cierra la sesión: es permiso, no autenticación", async () => {
    setAccessToken("token-bueno");
    setRefreshToken("refresco");
    server.use(
      mswHttp.get(`${API}/studio/projects`, () =>
        HttpResponse.json(
          { error: { code: "permission_denied", message: "No te toca" } },
          { status: 403 },
        ),
      ),
    );

    await http({ url: "/studio/projects" }).catch(() => undefined);

    expect(localStorage.getItem("access_token")).toBe("token-bueno");
  });

  it("manda el Authorization cuando hay token", async () => {
    setAccessToken("token-bueno");
    let recibido: string | null = null;
    server.use(
      mswHttp.get(`${API}/auth/me`, ({ request }) => {
        recibido = request.headers.get("authorization");
        return HttpResponse.json({ id: "1" });
      }),
    );

    await http({ url: "/auth/me" });

    expect(recibido).toBe("Bearer token-bueno");
  });

  it("devuelve undefined en 204 sin intentar parsear json", async () => {
    server.use(
      mswHttp.delete(`${API}/studio/x`, () => new HttpResponse(null, { status: 204 })),
    );

    await expect(http({ url: "/studio/x", method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("renovación del acceso", () => {
  /** El backend devuelve 401 cuando el access token expira (15 min). El cliente
   *  debe renovarlo y reintentar sin que el usuario se entere. */
  function backendConSesionCaducada(nuevoToken = "token-nuevo") {
    let renovado = false;
    let refrescos = 0;

    server.use(
      mswHttp.post(`${API}/auth/refresh`, () => {
        refrescos += 1;
        renovado = true;
        return HttpResponse.json({ access_token: nuevoToken });
      }),
      mswHttp.get(`${API}/learn/projects`, ({ request }) => {
        if (!renovado) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({
          autorizacion: request.headers.get("authorization"),
        });
      }),
    );

    return { refrescos: () => refrescos };
  }

  it("renueva y reintenta la petición con el token nuevo", async () => {
    setAccessToken("token-caducado");
    setRefreshToken("refresco-bueno");
    backendConSesionCaducada();

    const res = await http<{ autorizacion: string }>({ url: "/learn/projects" });

    expect(res.autorizacion).toBe("Bearer token-nuevo");
    expect(localStorage.getItem("access_token")).toBe("token-nuevo");
  });

  it("varias peticiones a la vez comparten un solo refresco", async () => {
    setAccessToken("token-caducado");
    setRefreshToken("refresco-bueno");
    const espia = backendConSesionCaducada();

    await Promise.all(
      Array.from({ length: 5 }, () => http({ url: "/learn/projects" })),
    );

    expect(espia.refrescos()).toBe(1);
  });

  it("si el refresco falla, cierra la sesión", async () => {
    setAccessToken("token-caducado");
    setRefreshToken("refresco-caducado");
    server.use(
      mswHttp.post(`${API}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      mswHttp.get(`${API}/auth/me`, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(http({ url: "/auth/me" })).rejects.toBeInstanceOf(ApiError);

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("no intenta renovar sin refresh token guardado", async () => {
    clearTokens();
    let refrescos = 0;
    server.use(
      mswHttp.post(`${API}/auth/refresh`, () => {
        refrescos += 1;
        return HttpResponse.json({ access_token: "x" });
      }),
      mswHttp.get(`${API}/auth/me`, () => new HttpResponse(null, { status: 401 })),
    );

    await http({ url: "/auth/me" }).catch(() => undefined);

    expect(refrescos).toBe(0);
  });

  it("un 401 del propio /auth/login no dispara renovación", async () => {
    setRefreshToken("refresco-bueno");
    let refrescos = 0;
    server.use(
      mswHttp.post(`${API}/auth/refresh`, () => {
        refrescos += 1;
        return HttpResponse.json({ access_token: "x" });
      }),
      mswHttp.post(`${API}/auth/login`, () => new HttpResponse(null, { status: 401 })),
    );

    await http({ url: "/auth/login", method: "POST", data: {} }).catch(() => undefined);

    expect(refrescos).toBe(0);
  });
});
