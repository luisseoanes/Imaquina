/** Guard de nombres accesibles en los formularios (I4).
 *
 *  Nace de un defecto real: en `LoginPage` los `<label>` eran hermanos del
 *  input, sin `htmlFor`, y los campos no tenían nombre accesible. El resto de
 *  la app usa el patrón envolvente, que sí es válido — así que esto comprueba
 *  el nombre computado, no la presencia de un atributo.
 *
 *  Renderiza cada pantalla con datos, no vacía: un formulario que sólo aparece
 *  cuando hay filas no se auditaría nunca.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http as mswHttp } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import AdminPage from "@/features/admin/AdminPage";
import ChatPanel from "@/features/chat/ChatPanel";
import AccountPage from "@/features/auth/AccountPage";
import { AuthProvider } from "@/features/auth/AuthProvider";
import LoginPage from "@/features/auth/LoginPage";
import MomentEditor from "@/features/studio/MomentEditor";
import ProjectsList from "@/features/studio/ProjectsList";
import TeacherPage from "@/features/teacher/TeacherPage";
import { API } from "@/test/handlers";
import { controlesSinNombre } from "@/test/a11y";
import { server } from "@/test/setup";

const USUARIOS = [
  {
    id: "u1",
    email: "alumno@imaquina.example.com",
    full_name: "Alumno Uno",
    role: "student",
    grade: "5",
    is_active: true,
  },
];
const CURSOS = [{ id: "c1", name: "Quinto A", grade: "5", teacher_id: null }];
const PROYECTOS = [{ id: "p1", slug: "semaforo", title: "Semáforo", grade: "5", order: 1 }];

const MID = "22222222-2222-2222-2222-222222222222";

const MOMENTO = {
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
      kind: "text",
      order: 0,
      media_asset_id: null,
      lang: "es",
      body: "<p>Hola</p>",
      caption: null,
      alt_text: null,
      langs: ["es"],
      updated_at: "2026-08-18T10:00:00Z",
    },
  ],
};

function montar(ui: React.ReactNode, role: string, ruta?: { path: string; at: string }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.setItem("session", JSON.stringify({ role, lang: "es" }));
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        {ruta ? (
          <MemoryRouter initialEntries={[ruta.at]}>
            <Routes>
              <Route path={ruta.path} element={ui} />
            </Routes>
          </MemoryRouter>
        ) : (
          <MemoryRouter>{ui}</MemoryRouter>
        )}
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("nombres accesibles de los formularios", () => {
  beforeEach(() => {
    server.use(
      mswHttp.get(`${API}/admin/users`, () => HttpResponse.json(USUARIOS)),
      mswHttp.get(`${API}/courses`, () => HttpResponse.json(CURSOS)),
      mswHttp.get(`${API}/courses/:id/students`, () => HttpResponse.json([])),
      mswHttp.get(`${API}/learn/projects`, () => HttpResponse.json(PROYECTOS)),
      mswHttp.get(`${API}/learn/projects/:id`, () =>
        HttpResponse.json({ ...PROYECTOS[0], moments: [] }),
      ),
      mswHttp.get(`${API}/learn/teacher/courses/:id/progress`, () => HttpResponse.json([])),
    );
  });

  it("administración: todos los campos tienen nombre", async () => {
    const { container } = montar(<AdminPage />, "admin");
    await screen.findByText("Alumno Uno");

    expect(controlesSinNombre(container)).toEqual([]);
  });

  it("panel docente: todos los campos tienen nombre", async () => {
    const { container } = montar(<TeacherPage />, "teacher");
    await waitFor(() => expect(container.querySelectorAll("select").length).toBeGreaterThan(0));

    expect(controlesSinNombre(container)).toEqual([]);
  });

  it("login: todos los campos tienen nombre", async () => {
    const { container } = montar(<LoginPage />, "student");
    await screen.findByRole("button", { name: "Iniciar sesión" });

    expect(controlesSinNombre(container)).toEqual([]);
  });

  it("mi cuenta: todos los campos tienen nombre", async () => {
    const { container } = montar(<AccountPage />, "student");
    await screen.findByRole("button", { name: "Cambiar contraseña" });

    expect(controlesSinNombre(container)).toEqual([]);
  });

  it("studio · listado de proyectos: todos los campos tienen nombre", async () => {
    server.use(
      mswHttp.get(`${API}/studio/catalog/projects`, () => HttpResponse.json([])),
    );
    const { container } = montar(<ProjectsList lang="es" />, "editor");
    await waitFor(() => expect(container.querySelectorAll("input").length).toBeGreaterThan(0));

    expect(controlesSinNombre(container)).toEqual([]);
  });

  it("chat: el campo de pregunta tiene nombre pese a llevar sólo placeholder", async () => {
    server.use(
      mswHttp.get(`${API}/chat/sessions`, () => HttpResponse.json([])),
      mswHttp.post(`${API}/chat/sessions`, () => HttpResponse.json({ id: "s1" })),
    );
    const { container } = montar(<ChatPanel momentId="m1" openingPrompt={null} />, "student");
    await waitFor(() => expect(container.querySelectorAll("input").length).toBeGreaterThan(0));

    expect(controlesSinNombre(container)).toEqual([]);
  });

  it("el chat anuncia la respuesta que llega por streaming", async () => {
    server.use(
      mswHttp.get(`${API}/chat/sessions`, () => HttpResponse.json([])),
      mswHttp.post(`${API}/chat/sessions`, () => HttpResponse.json({ id: "s1" })),
    );
    const { container } = montar(<ChatPanel momentId="m1" openingPrompt={null} />, "student");
    await waitFor(() => expect(container.querySelector("[aria-live]")).not.toBeNull());
  });

  it("studio · editor de momento: todos los campos tienen nombre", async () => {
    server.use(
      mswHttp.get(`${API}/studio/catalog/moments/${MID}`, () => HttpResponse.json(MOMENTO)),
    );
    const { container } = montar(<MomentEditor lang="es" />, "editor", {
      path: "/moments/:momentId",
      at: `/moments/${MID}`,
    });
    await waitFor(() => expect(container.querySelectorAll("input").length).toBeGreaterThan(0));

    expect(controlesSinNombre(container)).toEqual([]);
  });
});
