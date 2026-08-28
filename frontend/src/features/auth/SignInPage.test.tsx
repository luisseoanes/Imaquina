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
import i18n from "@/shared/i18n";
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

  it("el título de la pestaña lleva la marca y la sección", () => {
    renderizar();
    expect(document.title).toBe("IMaquina Robótica | Inicio de Sesión");
  });

  it("el título sigue al idioma, y la marca no se traduce", async () => {
    renderizar();
    await i18n.changeLanguage("en");
    // La marca también cambia: "Robótica" -> "Robotics".
    await waitFor(() => expect(document.title).toBe("IMaquina Robotics | Sign In"));
    await i18n.changeLanguage("es");
  });

  it("muestra los cuatro colaboradores", () => {
    renderizar();
    const seccion = screen.getByRole("region", { name: "Con la colaboración de" });
    for (const nombre of ["ubbu", "WhalesBot", "EnjoyAI", "Foodcash"]) {
      expect(within(seccion).getAllByAltText(nombre).length).toBeGreaterThan(0);
    }
  });

  it("cada colaborador enlaza a su sitio, y se abre aparte", () => {
    renderizar();
    const esperado: Record<string, string> = {
      ubbu: "https://ubbu.io/",
      WhalesBot: "https://www.whalesbot.ai/",
      EnjoyAI: "https://www.enjoyaiglobal.org/",
      Foodcash: "https://www.foodcash.com.co/",
    };
    for (const [nombre, url] of Object.entries(esperado)) {
      const enlace = screen.getByRole("link", { name: new RegExp(nombre, "i") });
      expect(enlace).toHaveAttribute("href", url);
      expect(enlace).toHaveAttribute("target", "_blank");
      // Sin `noopener` la página destino puede tocar la nuestra por window.opener.
      expect(enlace.getAttribute("rel")).toContain("noopener");
    }
  });

  it("en móvil no se pinta ninguna ilustración de fondo", () => {
    // El robot sólo existe en el panel de escritorio, que está oculto bajo
    // `lg`. Si volviera a haber uno suelto en el fondo, este contador sube.
    const { container } = renderizar();
    const robots = container.querySelectorAll('[data-testid="robot-ilustracion"]');
    expect(robots).toHaveLength(1);
    expect(robots[0]?.closest(".hidden")).not.toBeNull();
  });

  it("el logotipo trae las dos versiones, y sólo una se anuncia", () => {
    // La conmutación clara/oscura es CSS (`dark:`), no JavaScript, así que las
    // dos están en el DOM. Sólo la primera lleva texto alternativo: son la
    // misma marca y un lector de pantalla la anunciaría dos veces.
    const { container } = renderizar();
    const logos = [...container.querySelectorAll("img")].filter((i) =>
      i.getAttribute("src")?.includes("imaquina-horizontal"),
    );
    expect(logos).toHaveLength(2);
    expect(logos[0]).toHaveAttribute("alt", "IMaquina Robótica");
    expect(logos[0]?.className).toContain("dark:hidden");
    expect(logos[1]).toHaveAttribute("aria-hidden");
    expect(logos[1]?.className).toContain("dark:block");
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
