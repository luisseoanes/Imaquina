/** La pantalla de acceso.
 *
 *  Se prueba lo que puede romperse sin que nadie lo note: que el formulario
 *  sea usable con lector de pantalla, que el error del servidor llegue al
 *  usuario con el mensaje correcto, y que el robot sea realmente distinto
 *  entre cargas.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignInPage } from "./SignInPage";
import { ROBOTS } from "./useRandomRobot";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { crearQueryClient } from "@/app/providers/queryClient";
import { API } from "@/test/handlers";
import { server } from "@/test/server";

function renderizar() {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <SignInPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("pantalla de acceso", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("los campos tienen nombre accesible, no sólo placeholder", () => {
    renderizar();
    // `getByLabelText` falla si la etiqueta no está asociada al input: es la
    // comprobación de que un lector de pantalla los anuncia bien.
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("la contraseña se puede revelar y volver a ocultar", async () => {
    const user = userEvent.setup();
    renderizar();
    const campo = screen.getByLabelText("Contraseña");
    expect(campo).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar la contraseña" }));
    expect(campo).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Ocultar la contraseña" }));
    expect(campo).toHaveAttribute("type", "password");
  });

  it("un correo o contraseña incorrectos se anuncian como alerta", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { error: { code: "permission_denied", message: "Credenciales invalidas" } },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText("Correo electrónico"), "a@imaquina.example.com");
    await user.type(screen.getByLabelText("Contraseña"), "loquesea");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("El correo o la contraseña no coinciden.");
  });

  it("una licencia vencida NO se confunde con una contraseña mala", async () => {
    // Decirle "credenciales inválidas" a quien tiene la licencia caducada lo
    // manda a reintentar algo que ya estaba bien.
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { error: { code: "license_expired", message: "vencida" } },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText("Correo electrónico"), "a@imaquina.example.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave-12345");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/licencia/i);
  });

  it("no ofrece registro ni acceso con proveedores externos", () => {
    // El backend no expone ninguna de las dos cosas: las cuentas las crea el
    // administrador de la institución. Ofrecerlas seria prometer lo que no hay.
    renderizar();
    expect(screen.queryByText(/crear cuenta|reg[íi]strate|sign up/i)).toBeNull();
    expect(screen.queryByText(/google|apple/i)).toBeNull();
  });

  it("el robot cambia entre cargas", () => {
    // El sorteo se hace una vez por montaje. Se fuerza el valor de Math.random
    // para comprobar que elige robots distintos y no siempre el primero.
    const vistos = new Set<string>();
    for (const azar of [0.05, 0.45, 0.95]) {
      vi.spyOn(Math, "random").mockReturnValue(azar);
      const { container, unmount } = renderizar();
      const img = container.querySelector<HTMLImageElement>('[data-testid="robot-ilustracion"]');
      vistos.add(img?.getAttribute("src") ?? "");
      unmount();
    }
    expect(vistos.size).toBe(3);
  });

  it("dentro de una misma carga, el robot del panel y el del fondo son el mismo", () => {
    const { container } = renderizar();
    const fuentes = [...container.querySelectorAll('[data-testid="robot-ilustracion"]')].map(
      (el) => el.getAttribute("src"),
    );
    expect(fuentes.length).toBeGreaterThan(1);
    expect(new Set(fuentes).size).toBe(1);
  });

  it("muestra los cuatro colaboradores", () => {
    renderizar();
    const seccion = screen.getByRole("region", { name: "Con la colaboración de" });
    for (const nombre of ["ubbu", "WhalesBot", "EnjoyAI", "Foodcash"]) {
      expect(within(seccion).getAllByAltText(nombre).length).toBeGreaterThan(0);
    }
  });

  it("todos los robots del sorteo existen", () => {
    expect(ROBOTS).toHaveLength(5);
    expect(new Set(ROBOTS).size).toBe(5);
  });

  it("entrar lleva al panel", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          access_token: "a",
          refresh_token: "r",
          token_type: "bearer",
          role: "student",
          lang: "es",
        }),
      ),
    );
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText("Correo electrónico"), "a@imaquina.example.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave-12345");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("session") ?? "{}").role).toBe("student"),
    );
  });
});
