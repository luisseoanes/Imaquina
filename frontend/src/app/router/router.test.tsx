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
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";
import type { Session } from "@/app/providers/authContext";
import { routes } from "@/shared/config/routes";

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
      // Va diferido con `lazy()`: hay que esperar a que resuelva el import.
      await waitFor(() => expect(pantallaMontada(container)).toBe("TeacherPage"));
    });

    it("un editor sí entra al Content Studio", async () => {
      iniciarSesion(EDITOR);
      const { container } = renderizarEn(routes.studio);
      await waitFor(() => expect(pantallaMontada(container)).toBe("StudioPage"));
    });
  });
});
