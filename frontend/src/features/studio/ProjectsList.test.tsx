/** El Studio contra la API real simulada.
 *
 *  Estos tests existen porque el backend del Content Studio se construyó entero
 *  sin ningún consumidor: son la primera comprobación de que las formas que
 *  devuelve sirven para pintar una pantalla.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as mswHttp } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { API } from "@/test/handlers";
import { server } from "@/test/setup";
import ProjectsList from "./ProjectsList";

const CATALOGO = `${API}/studio/catalog/projects`;

function envolver(nodo: ReactNode) {
  // Sin reintentos: un test no debe esperar a que TanStack Query reintente.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{nodo}</MemoryRouter>
    </QueryClientProvider>
  );
}

const PROYECTO = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "semaforo",
  grade: "5",
  kit: "Kit A",
  order: 0,
  status: "draft",
  lang: "es",
  title: "Semáforo inteligente",
  summary: null,
  langs: ["es"],
};

describe("listado del Studio", () => {
  beforeEach(() => {
    server.use(mswHttp.get(CATALOGO, () => HttpResponse.json([PROYECTO])));
  });

  it("pinta los proyectos con su estado e idiomas", async () => {
    render(envolver(<ProjectsList lang="es" />));

    expect(await screen.findByText("Semáforo inteligente")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getByText("es")).toBeInTheDocument();
  });

  it("el listado del editor incluye borradores, no como el del estudiante", async () => {
    render(envolver(<ProjectsList lang="es" />));

    await screen.findByText("Semáforo inteligente");
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("un proyecto sin título no se pinta vacío", async () => {
    server.use(
      mswHttp.get(CATALOGO, () =>
        HttpResponse.json([{ ...PROYECTO, title: null, langs: [] }]),
      ),
    );
    render(envolver(<ProjectsList lang="es" />));

    expect(await screen.findByText("(sin título)")).toBeInTheDocument();
  });

  it("avisa cuando no hay ninguno", async () => {
    server.use(mswHttp.get(CATALOGO, () => HttpResponse.json([])));
    render(envolver(<ProjectsList lang="es" />));

    expect(
      await screen.findByText("Todavía no hay proyectos. Crea el primero."),
    ).toBeInTheDocument();
  });
});

describe("creación", () => {
  beforeEach(() => {
    server.use(mswHttp.get(CATALOGO, () => HttpResponse.json([])));
  });

  it("deriva el identificador del título y manda el idioma de edición", async () => {
    let recibido: Record<string, unknown> | null = null;
    server.use(
      mswHttp.post(CATALOGO, async ({ request }) => {
        recibido = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...PROYECTO, moments: [] }, { status: 201 });
      }),
    );
    render(envolver(<ProjectsList lang="en" />));

    await userEvent.type(screen.getByLabelText("Título"), "Semáforo Inteligente");
    await userEvent.type(screen.getByLabelText("Grado"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(recibido).not.toBeNull());
    expect(recibido).toMatchObject({
      title: "Semáforo Inteligente",
      // sin acentos ni mayúsculas ni espacios: va en la URL
      slug: "semaforo-inteligente",
      grade: "5",
      lang: "en",
    });
  });

  it("muestra el mensaje del backend cuando el slug ya existe", async () => {
    server.use(
      mswHttp.post(CATALOGO, () =>
        HttpResponse.json(
          {
            error: {
              code: "conflict",
              message: "Ya existe un proyecto con el slug 'semaforo'",
            },
          },
          { status: 409 },
        ),
      ),
    );
    render(envolver(<ProjectsList lang="es" />));

    await userEvent.type(screen.getByLabelText("Título"), "Semáforo");
    await userEvent.type(screen.getByLabelText("Grado"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(
      await screen.findByText("Ya existe un proyecto con el slug 'semaforo'"),
    ).toBeInTheDocument();
  });

  it("no deja enviar sin los campos obligatorios", async () => {
    render(envolver(<ProjectsList lang="es" />));

    expect(screen.getByRole("button", { name: "Crear" })).toBeDisabled();
  });
});
