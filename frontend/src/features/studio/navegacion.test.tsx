/** El recorrido del editor por el Content Studio, de punta a punta.
 *
 *  Igual que `features/projects/navegacion.test.tsx`: un test de componente
 *  aislado no ve si las rutas anidadas conectan de verdad. Esto renderiza
 *  `<App>` completa y navega.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as mswHttp } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import App from "@/App";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { API } from "@/test/handlers";
import { server } from "@/test/setup";

const PID = "11111111-1111-1111-1111-111111111111";
const MID = "22222222-2222-2222-2222-222222222222";

const PROYECTO = {
  id: PID,
  slug: "semaforo",
  grade: "5",
  kit: "Kit A",
  order: 0,
  status: "draft",
  lang: "es",
  title: "Semáforo inteligente",
  summary: null,
  langs: ["es"],
  updated_at: "2026-08-18T10:00:00Z",
};

const MOMENTO = {
  id: MID,
  type: "intro",
  order: 0,
  title: "Introducción",
  blocks: 0,
  langs: [],
};

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.setItem("session", JSON.stringify({ role: "editor", lang: "es" }));
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/studio"]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("recorrido del editor en el Studio", () => {
  beforeEach(() => {
    server.use(
      mswHttp.get(`${API}/studio/catalog/projects`, () => HttpResponse.json([PROYECTO])),
      mswHttp.get(`${API}/studio/catalog/projects/:id`, () =>
        HttpResponse.json({ ...PROYECTO, moments: [MOMENTO] }),
      ),
      mswHttp.get(`${API}/studio/catalog/projects/:id/translations`, () =>
        HttpResponse.json([{ lang: "es", complete: false, missing: ["algo"] }]),
      ),
      mswHttp.get(`${API}/studio/catalog/moments/:id`, () =>
        HttpResponse.json({
          id: MID,
          project_id: PID,
          type: "intro",
          order: 0,
          lang: "es",
          title: "Introducción",
          teacher_note: null,
          chatbot_opening_prompt: null,
          langs: [],
          updated_at: "2026-08-18T10:00:00Z",
          blocks: [],
        }),
      ),
    );
  });

  it("del listado se llega al proyecto y del proyecto al editor del momento", async () => {
    renderApp();

    await userEvent.click(await screen.findByText("Semáforo inteligente"));

    expect(await screen.findByText("Momentos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("link", { name: /Introducción/ }));

    expect(await screen.findByDisplayValue("Introducción")).toBeInTheDocument();
  });

  it("desde el Studio se puede cerrar sesión y volver al resto de la app", async () => {
    // El Studio colgaba de RequireAuthor a secas, sin RequireAuth, así que no
    // montaba AppHeader: una vez dentro no había forma de salir salvo editar
    // la URL a mano.
    renderApp();
    await screen.findByRole("heading", { name: "Content Studio" });

    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mi cuenta" })).toBeInTheDocument();
  });

  it("distingue el idioma de la interfaz del idioma de edición", async () => {
    // Con AppHeader montado hay dos pares ES/EN en pantalla; el del Studio es
    // el de EDICIÓN y tiene que decirlo.
    renderApp();
    await screen.findByRole("heading", { name: "Content Studio" });

    expect(screen.getByText("Idioma de edición")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Idioma de edición" }),
    ).toBeInTheDocument();
  });

  it("un docente no entra al Studio", async () => {
    server.use(mswHttp.get(`${API}/learn/projects`, () => HttpResponse.json([])));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    localStorage.setItem("session", JSON.stringify({ role: "teacher", lang: "es" }));
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/studio"]}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Aún no hay proyectos publicados")).toBeInTheDocument();
    expect(screen.queryByText("Content Studio")).not.toBeInTheDocument();
  });
});
