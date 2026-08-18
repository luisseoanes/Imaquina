/** El cliente HTTP traduce el sobre de error del backend y limpia el token
 *  cuando el servidor dice que ya no vale. Las dos cosas son contrato con
 *  `app/core/errors.py`, no detalle interno. */
import { HttpResponse, http as mswHttp } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/setup";
import { API } from "@/test/handlers";
import { ApiError, http, setAccessToken } from "./http";

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

  it("borra el token cuando el backend responde 401", async () => {
    setAccessToken("token-viejo");
    server.use(
      mswHttp.get(`${API}/auth/me`, () => new HttpResponse(null, { status: 401 })),
    );

    await http({ url: "/auth/me" }).catch(() => undefined);

    expect(localStorage.getItem("access_token")).toBeNull();
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
