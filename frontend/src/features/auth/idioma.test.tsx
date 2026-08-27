/** Selector de idioma, de punta a punta (I1, I7, R6).
 *
 *  Se navega la app entera: lo que estaba roto no era sólo la falta de botón,
 *  sino que el idioma NUNCA llegaba a los endpoints del estudiante — las tres
 *  queries usaban el `lang="es"` por defecto del backend, así que el contenido
 *  habría seguido en español con el selector puesto.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as mswHttp } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import App from "@/App";
import { AuthProvider } from "@/features/auth/AuthProvider";
import i18n, { setLanguage } from "@/i18n";
import { API } from "@/test/handlers";
import { server } from "@/test/setup";

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.setItem("session", JSON.stringify({ role: "student", lang: "es" }));
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("selector de idioma", () => {
  let langsPedidos: (string | null)[] = [];

  beforeEach(async () => {
    localStorage.clear();
    langsPedidos = [];
    setLanguage("es");
    await i18n.changeLanguage("es");
    server.use(
      mswHttp.get(`${API}/learn/projects`, ({ request }) => {
        langsPedidos.push(new URL(request.url).searchParams.get("lang"));
        return HttpResponse.json([]);
      }),
      mswHttp.patch(`${API}/auth/me`, () => HttpResponse.json({ lang: "en" })),
    );
  });

  afterEach(async () => {
    setLanguage("es");
    await i18n.changeLanguage("es");
  });

  it("cambia el idioma de la interfaz al pulsarlo", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("button", { name: "EN" });

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(await screen.findByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("vuelve a pedir el contenido en el idioma nuevo", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => expect(langsPedidos).toEqual(["es"]));

    await user.click(screen.getByRole("button", { name: "EN" }));

    await waitFor(() => expect(langsPedidos).toEqual(["es", "en"]));
  });

  it("actualiza <html lang> al cambiar de idioma", async () => {
    // WCAG 3.1.1: `index.html` trae lang="es" fijo, así que sin esto un
    // usuario en inglés tiene el documento declarado como español y el lector
    // de pantalla lo pronuncia como tal.
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("button", { name: "EN" });
    expect(document.documentElement.lang).toBe("es");

    await user.click(screen.getByRole("button", { name: "EN" }));

    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });

  it("persiste la preferencia en la cuenta", async () => {
    let guardado: unknown = null;
    server.use(
      mswHttp.patch(`${API}/auth/me`, async ({ request }) => {
        guardado = await request.json();
        return HttpResponse.json({ lang: "en" });
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("button", { name: "EN" });

    await user.click(screen.getByRole("button", { name: "EN" }));

    await waitFor(() => expect(guardado).toEqual({ lang: "en" }));
  });

  it("al volver a entrar manda el idioma de la CUENTA, no el del navegador", async () => {
    // El ciclo completo: cambio a inglés, cierro sesión, vuelvo a entrar y
    // sigue en inglés porque lo dice el servidor. Y al revés: si la cuenta
    // dice "es", el "en" que quedó en este navegador NO debe ganar.
    server.use(
      mswHttp.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          access_token: "a",
          refresh_token: "r",
          token_type: "bearer",
          role: "student",
          lang: "en",
        }),
      ),
    );
    localStorage.setItem("lang", "es");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/Correo|Email/), "a@imaquina.example.com");
    await user.type(screen.getByLabelText(/Contraseña|Password/), "clave-12345");
    await user.click(screen.getByRole("button", { name: /Iniciar sesión|Sign in/ }));

    expect(await screen.findByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(localStorage.getItem("lang")).toBe("en");
  });

  it("si guardar la preferencia falla, el idioma cambia igual", async () => {
    // Best-effort, mismo criterio que la revocación del logout: no dejar al
    // usuario atrapado en un idioma por un fallo de red.
    server.use(
      mswHttp.patch(`${API}/auth/me`, () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("button", { name: "EN" });

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(await screen.findByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
