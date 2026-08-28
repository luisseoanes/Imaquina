/** La pantalla de 404.
 *
 *  Lo que importa aquí es la salida: que exista, que lleve al sitio correcto
 *  según haya sesión o no, y que la ruta comodín la muestre de verdad.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { crearQueryClient } from "@/app/providers/queryClient";
import type { Session } from "@/app/providers/authContext";
import { routes } from "@/shared/config/routes";

function renderizarEn(ruta: string, session?: Session) {
  if (session) {
    localStorage.setItem("session", JSON.stringify(session));
    localStorage.setItem("access_token", "token-de-prueba");
  }
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("página no encontrada", () => {
  it("sin sesión ofrece ir al inicio de sesión", () => {
    renderizarEn("/ruta-que-no-existe");

    expect(screen.getByRole("heading", { name: "Esta página no existe" })).toBeInTheDocument();
    const salida = screen.getByRole("link", { name: /Ir al inicio de sesión/ });
    expect(salida).toHaveAttribute("href", routes.login);
  });

  it("con sesión la salida es la herramienta del rol, no el acceso ni la raíz", () => {
    // Mandar al inicio de sesión a quien ya tiene sesión abierta parece que le
    // echaron; y `/` es esta misma pantalla, así que enlazarla no sale de aquí.
    renderizarEn("/ruta-que-no-existe", { role: "student", lang: "es" });

    const salida = screen.getByRole("link", { name: /Volver al panel/ });
    expect(salida).toHaveAttribute("href", routes.student);
  });

  it("un editor vuelve al Studio desde el 404", () => {
    renderizarEn("/ruta-que-no-existe", { role: "editor", lang: "es" });
    expect(screen.getByRole("link", { name: /Volver al panel/ })).toHaveAttribute(
      "href",
      routes.studio,
    );
  });

  it("pone su propio título de pestaña", () => {
    renderizarEn("/ruta-que-no-existe");
    expect(document.title).toBe("IMaquina Robótica | Página No Encontrada");
  });

  it("no pinta la ilustración en móvil", () => {
    const { container } = renderizarEn("/ruta-que-no-existe");
    const robot = container.querySelector('[data-testid="robot-ilustracion"]');
    expect(robot?.className).toContain("hidden");
  });
});
