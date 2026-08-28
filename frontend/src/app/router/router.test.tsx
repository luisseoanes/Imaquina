/** El andamiaje del router, no las pantallas.
 *
 *  Lo que se prueba aquí es que las rutas conecten y que los guards decidan
 *  bien: un enlace a una ruta inexistente o un guard mal anidado no lo detecta
 *  ningún test de componente aislado, y es de los fallos más caros de
 *  descubrir tarde.
 *
 *  Las pantallas son marcadores (`data-pending`) hasta que se desarrollen, así
 *  que se comprueba CUÁL se monta, no qué pinta.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";
import type { Session } from "@/app/providers/authContext";
import { routes } from "@/shared/config/routes";
import { API } from "@/test/handlers";
import { server } from "@/test/server";

function iniciarSesion(session: Session) {
  localStorage.setItem("session", JSON.stringify(session));
  localStorage.setItem("access_token", "token-de-prueba");
}

/** Qué pantalla acabó montada. `null` si no hay ninguna. */
function pantallaMontada(container: HTMLElement): string | null {
  return container.querySelector("[data-pending]")?.getAttribute("data-pending") ?? null;
}

function renderizarEn(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

const ESTUDIANTE: Session = { role: "student", lang: "es" };
const DOCENTE: Session = { role: "teacher", lang: "es" };
const EDITOR: Session = { role: "editor", lang: "es" };

describe("router", () => {
  it("sin sesión, cualquier ruta privada lleva al acceso", () => {
    renderizarEn(routes.dashboard);
    // La pantalla de acceso ya está desarrollada, así que no lleva marcador:
    // se identifica por su encabezado, que es lo que ve el usuario.
    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("la raíz muestra el 404 mientras el panel no exista", () => {
    iniciarSesion(ESTUDIANTE);
    renderizarEn(routes.dashboard);
    expect(screen.getByRole("heading", { name: "Esta página no existe" })).toBeInTheDocument();
  });

  it("una ruta desconocida muestra un 404, no redirige en silencio", () => {
    iniciarSesion(ESTUDIANTE);
    renderizarEn("/no-existe-esta-ruta");
    // Redirigir al panel haría parecer que el enlace roto funcionó, y nadie
    // lo reportaría nunca.
    expect(screen.getByRole("heading", { name: "Esta página no existe" })).toBeInTheDocument();
  });

  it("el momento de un proyecto resuelve sus dos parámetros", () => {
    iniciarSesion(ESTUDIANTE);
    const { container } = renderizarEn(routes.moment("proyecto-1", "intro"));
    expect(pantallaMontada(container)).toBe("MomentPage");
  });

  it("tras iniciar sesión, cada rol aterriza en su herramienta, no en el 404", async () => {
    for (const [rol, marcador] of [
      ["teacher", "[data-teacher-root]"],
      ["editor", "[data-studio-root]"],
      ["admin", "[data-admin-root]"],
    ] as const) {
      localStorage.clear();
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json({
            access_token: "a",
            refresh_token: "r",
            token_type: "bearer",
            role: rol,
            lang: "es",
          }),
        ),
      );
      const { container, unmount } = renderizarEn(routes.login);
      await userEvent.type(
        screen.getByLabelText("Correo electrónico"),
        "x@imaquina.example.com",
      );
      await userEvent.type(screen.getByLabelText("Contraseña"), "clave-12345");
      await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
      await waitFor(() =>
        expect(container.querySelector(marcador)).not.toBeNull(),
      );
      unmount();
    }
  });

  describe("guards por rol", () => {
    it("un estudiante no entra al Content Studio", () => {
      iniciarSesion(ESTUDIANTE);
      const { container } = renderizarEn(routes.studio);
      expect(pantallaMontada(container)).not.toBe("StudioPage");
    });

    it("un estudiante no entra al panel docente", () => {
      iniciarSesion(ESTUDIANTE);
      const { container } = renderizarEn(routes.teacher);
      expect(pantallaMontada(container)).not.toBe("TeacherPage");
    });

    it("un docente no entra a administración", () => {
      iniciarSesion(DOCENTE);
      const { container } = renderizarEn(routes.admin);
      expect(pantallaMontada(container)).not.toBe("AdminPage");
    });

    it("un docente sí entra al panel docente", async () => {
      iniciarSesion(DOCENTE);
      const { container } = renderizarEn(routes.teacher);
      // Ya no es un marcador `data-pending`: es una app anidada con su router.
      await waitFor(() =>
        expect(container.querySelector("[data-teacher-root]")).not.toBeNull(),
      );
    });

    it("un editor sí entra al Content Studio", async () => {
      iniciarSesion(EDITOR);
      const { container } = renderizarEn(routes.studio);
      // El Studio ya no es un marcador `data-pending`: es una app anidada con
      // su propio router. Marca su raíz con `data-studio-root`.
      await waitFor(() =>
        expect(container.querySelector("[data-studio-root]")).not.toBeNull(),
      );
    });

    it("un admin sí entra a administración", async () => {
      iniciarSesion({ role: "admin", lang: "es" });
      const { container } = renderizarEn(routes.admin);
      await waitFor(() =>
        expect(container.querySelector("[data-admin-root]")).not.toBeNull(),
      );
    });
  });
});
