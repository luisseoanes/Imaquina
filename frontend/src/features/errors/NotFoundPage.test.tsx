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

  it("con sesión ofrece lo mismo: el inicio de sesión", () => {
    // Es la única pantalla construida, así que es la salida en los dos casos.
    renderizarEn("/ruta-que-no-existe", { role: "student", lang: "es" });

    const salida = screen.getByRole("link", { name: /Ir al inicio de sesión/ });
    expect(salida).toHaveAttribute("href", routes.login);
  });

  it("la raíz también muestra el 404", () => {
    renderizarEn(routes.dashboard, { role: "student", lang: "es" });
    expect(screen.getByRole("heading", { name: "Esta página no existe" })).toBeInTheDocument();
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
