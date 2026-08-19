/** El recorrido del estudiante, de punta a punta.
 *
 *  Los tests de componente aislado no vieron que `ProjectsPage` enlazaba a una
 *  ruta inexistente: el comodín devolvía al listado y no había forma de llegar
 *  a un momento. Esto renderiza la app entera y NAVEGA.
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

const PROYECTO = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "semaforo",
  grade: "5",
  kit: "Kit A",
  title: "Semáforo inteligente",
  summary: "Construye un semáforo.",
  lang: "es",
  langs: ["es"],
};

const MOMENTOS = [
  { id: "m1", type: "intro", order: 0, title: "Introducción", blocks: [{ id: "b1" }] },
  { id: "m2", type: "inquiry", order: 1, title: "Indagación", blocks: [] },
];

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

describe("recorrido del estudiante", () => {
  beforeEach(() => {
    server.use(
      mswHttp.get(`${API}/learn/projects`, () => HttpResponse.json([PROYECTO])),
      mswHttp.get(`${API}/learn/projects/:id`, () =>
        HttpResponse.json({ ...PROYECTO, moments: MOMENTOS }),
      ),
      mswHttp.get(`${API}/learn/projects/:id/moments/:type`, () =>
        HttpResponse.json({
          id: "m1",
          type: "intro",
          title: "Introducción",
          blocks: [{ id: "b1", kind: "text", body: "Hoy construimos un semáforo." }],
          chatbot_opening_prompt: null,
        }),
      ),
      mswHttp.post(`${API}/chat/sessions`, () =>
        HttpResponse.json({ session_id: "s1" }),
      ),
    );
  });

  it("del listado se llega al proyecto y del proyecto al momento", async () => {
    renderApp();

    await userEvent.click(await screen.findByText("Semáforo inteligente"));

    // Antes esto rebotaba al listado: la ruta /projects/:id no existía.
    expect(await screen.findByText("Momentos")).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("link", { name: /Introducción/ }),
    );

    expect(
      await screen.findByText("Hoy construimos un semáforo."),
    ).toBeInTheDocument();
  });

  it("un momento sin contenido no es un enlace roto", async () => {
    renderApp();
    await userEvent.click(await screen.findByText("Semáforo inteligente"));

    await screen.findByText("Momentos");
    expect(screen.getByText("Sin contenido todavía")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Indagación/ })).toBeNull();
  });

  it("desde el momento se vuelve al proyecto, no al principio", async () => {
    renderApp();
    await userEvent.click(await screen.findByText("Semáforo inteligente"));
    await userEvent.click(
      await screen.findByRole("link", { name: /Introducción/ }),
    );

    await userEvent.click(await screen.findByText(/Volver al proyecto/));

    expect(await screen.findByText("Momentos")).toBeInTheDocument();
  });
});
