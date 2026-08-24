/** El editor de bloques (S13) contra la API simulada. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as mswHttp } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { API } from "@/test/handlers";
import { server } from "@/test/setup";
import MomentEditor from "./MomentEditor";

const MID = "22222222-2222-2222-2222-222222222222";
const MOMENTS = `${API}/studio/catalog/moments`;
const BLOCKS = `${API}/studio/catalog/blocks`;

const MOMENTO_BASE = {
  id: MID,
  project_id: "p1",
  type: "intro",
  order: 0,
  lang: "es",
  title: "Introducción",
  teacher_note: null,
  chatbot_opening_prompt: null,
  langs: ["es"],
  updated_at: "2026-08-18T10:00:00Z",
  blocks: [
    {
      id: "b1",
      moment_id: MID,
      kind: "embed",
      order: 0,
      media_asset_id: null,
      lang: "es",
      body: "https://youtube.com/embed/x",
      caption: null,
      alt_text: null,
      langs: ["es"],
      updated_at: "2026-08-18T10:00:00Z",
    },
  ],
};

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/moments/${MID}`]}>
        <Routes>
          <Route path="/moments/:momentId" element={nodo} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("editor de momento", () => {
  beforeEach(() => {
    server.use(
      mswHttp.get(`${MOMENTS}/:id`, () => HttpResponse.json(MOMENTO_BASE)),
      mswHttp.get(`${MOMENTS}/:id/preview`, () =>
        HttpResponse.json({ ...MOMENTO_BASE, teacher_note: undefined }),
      ),
    );
  });

  it("pinta los campos del momento y sus bloques", async () => {
    render(envolver(<MomentEditor lang="es" />));

    expect(await screen.findByDisplayValue("Introducción")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://youtube.com/embed/x")).toBeInTheDocument();
  });

  it("añadir un bloque llama al backend con el tipo elegido", async () => {
    let recibido: Record<string, unknown> | null = null;
    server.use(
      mswHttp.post(`${MOMENTS}/:id/blocks`, async ({ request }) => {
        recibido = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...MOMENTO_BASE.blocks[0], id: "b2" }, { status: 201 });
      }),
    );
    render(envolver(<MomentEditor lang="es" />));

    await screen.findByDisplayValue("Introducción");
    await userEvent.click(screen.getByRole("button", { name: /\+ Imagen/ }));

    await waitFor(() => expect(recibido).not.toBeNull());
    expect(recibido).toMatchObject({ kind: "image" });
  });

  it("borrar un bloque llama al DELETE", async () => {
    let borrado = false;
    server.use(
      mswHttp.delete(`${BLOCKS}/:id`, () => {
        borrado = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(envolver(<MomentEditor lang="es" />));

    await screen.findByDisplayValue("https://youtube.com/embed/x");
    await userEvent.click(screen.getByRole("button", { name: "Borrar bloque" }));

    await waitFor(() => expect(borrado).toBe(true));
  });

  it("un 409 al guardar el título muestra el aviso de conflicto", async () => {
    server.use(
      mswHttp.patch(`${MOMENTS}/:id`, () =>
        HttpResponse.json(
          { error: { code: "conflict", message: "El contenido cambió en otra sesión." } },
          { status: 409 },
        ),
      ),
    );
    render(envolver(<MomentEditor lang="es" />));

    const campoTitulo = await screen.findByDisplayValue("Introducción");
    await userEvent.type(campoTitulo, " nuevo");
    await userEvent.tab();

    expect(await screen.findByText(/cambió en otra sesión/)).toBeInTheDocument();
  });

  it("la vista previa como estudiante no trae la guía docente", async () => {
    server.use(
      mswHttp.get(`${MOMENTS}/:id/preview`, ({ request }) => {
        const url = new URL(request.url);
        const teacherNote =
          url.searchParams.get("as") === "teacher" ? "solo para el profe" : undefined;
        return HttpResponse.json({ ...MOMENTO_BASE, teacher_note: teacherNote });
      }),
    );
    render(envolver(<MomentEditor lang="es" />));

    await screen.findByDisplayValue("Introducción");
    await userEvent.click(screen.getByRole("button", { name: /Estudiante/ }));

    await screen.findByText("Cerrar vista previa");
    expect(screen.queryByText("solo para el profe")).not.toBeInTheDocument();
  });
});
