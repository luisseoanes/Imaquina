/** El recorrido del estudiante, montando `<App>` y navegando de verdad.
 *
 *  Lo que se prueba es lo que decide si el flujo sirve: que se llegue al
 *  siguiente momento sin adivinar la URL, que un momento bloqueado se explique
 *  en vez de parecer un fallo, que completar avance, y que la evaluación se
 *  pueda responder y enviar.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";
import type { Attempt } from "./api";
import { API } from "@/test/handlers";
import { server } from "@/test/server";

function login(role: "student" | "teacher" = "student") {
  localStorage.setItem("session", JSON.stringify({ role, lang: "es" }));
  localStorage.setItem("access_token", "token-de-prueba");
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const ME_ESTUDIANTE = {
  id: "u1",
  email: "ana@imaquina.example.com",
  full_name: "Ana Ruiz",
  role: "student",
  grade: "5",
  lang: "es",
};

const PROYECTO = {
  id: "p1",
  slug: "brazo-robotico",
  grade: "5",
  title: "Brazo robótico",
  summary: "Construye un brazo con tres articulaciones.",
  lang: "es",
};

const MOMENTOS = [
  "intro",
  "inquiry",
  "design",
  "build",
  "communicate",
  "assess",
].map((type, i) => ({
  id: `m-${type}`,
  type,
  order: i,
  title: `Momento ${type}`,
  chatbot_opening_prompt: null,
  blocks: [],
}));

function conCatalogo(progress: Record<string, string> = {}) {
  server.use(
    http.get(`${API}/auth/me`, () => HttpResponse.json(ME_ESTUDIANTE)),
    http.get(`${API}/learn/projects`, () => HttpResponse.json([PROYECTO])),
    http.get(`${API}/learn/projects/:id`, () =>
      HttpResponse.json({ ...PROYECTO, kit: "Kit A", langs: ["es"], moments: MOMENTOS }),
    ),
    http.get(`${API}/learn/projects/:id/progress`, () => HttpResponse.json(progress)),
  );
}

describe("Panel del estudiante", () => {
  beforeEach(() => login());

  it("la barra lateral sólo enlaza lo que existe, y marca lo pendiente", async () => {
    conCatalogo();
    renderAt("/student");

    for (const label of ["Inicio", "Mis proyectos", "Evaluaciones", "Mi cuenta"]) {
      expect(await screen.findByRole("link", { name: label })).toBeInTheDocument();
    }
    // "Mensajes" no tiene backend: se muestra, pero no es un enlace.
    expect(screen.queryByRole("link", { name: /Mensajes/ })).toBeNull();
    expect(screen.getByText("Mensajes")).toBeInTheDocument();
  });

  it("el panel ofrece continuar por el primer momento sin completar", async () => {
    conCatalogo({ intro: "completed" });
    renderAt("/student");

    // Hay dos: la tarjeta grande de "Siguiente paso" y la del proyecto. Las
    // dos tienen que apuntar al mismo sitio, o el estudiante acaba en un
    // momento distinto según por dónde pulse.
    const enlaces = await screen.findAllByRole("link", { name: /Continuar/ });
    // `inquiry` es el siguiente de `intro` en el orden fijo de los seis
    // momentos: el enlace se construye, no se escribe a mano.
    for (const enlace of enlaces) {
      expect(enlace).toHaveAttribute("href", "/student/courses/p1/inquiry");
    }
  });

  it("un proyecto sin empezar propone empezarlo por la introducción", async () => {
    conCatalogo();
    renderAt("/student/courses");

    const empezar = await screen.findAllByRole("link", { name: /Empezar/ });
    expect(empezar[0]).toHaveAttribute("href", "/student/courses/p1/intro");
  });

  it("el índice del proyecto pinta con candado lo que aún no toca", async () => {
    conCatalogo();
    renderAt("/student/courses/p1");

    // `intro` está abierto desde el principio; el resto, no.
    expect(
      await screen.findByRole("link", { name: /Momento intro/ }),
    ).toHaveAttribute("href", "/student/courses/p1/intro");
    expect(screen.queryByRole("link", { name: /Momento build/ })).toBeNull();
    expect(screen.getAllByText("Bloqueado").length).toBeGreaterThan(0);
  });

  it("un momento bloqueado se explica en vez de mostrar un error", async () => {
    conCatalogo();
    server.use(
      http.get(`${API}/learn/projects/:id/moments/:type`, () =>
        HttpResponse.json(
          {
            error: {
              code: "permission_denied",
              message: "Completa el momento 'intro' antes de entrar a 'design'",
            },
          },
          { status: 403 },
        ),
      ),
    );
    renderAt("/student/courses/p1/design");

    expect(
      await screen.findByRole("heading", { name: "Este momento está bloqueado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Completa el momento 'intro' antes de entrar a 'design'/),
    ).toBeInTheDocument();
  });

  it("completar un momento lleva al siguiente", async () => {
    const user = userEvent.setup();
    conCatalogo();
    const completado = vi.fn();
    server.use(
      http.get(`${API}/learn/projects/:id/moments/:type`, ({ params }) =>
        HttpResponse.json({
          id: `m-${params.type as string}`,
          type: params.type,
          order: 0,
          title: "La articulación",
          chatbot_opening_prompt: "¿Qué es una articulación?",
          blocks: [
            {
              id: "b1",
              kind: "text",
              order: 0,
              media_asset_id: null,
              body: "<p>Un brazo se mueve por sus articulaciones.</p>",
              caption: null,
              alt_text: null,
            },
          ],
          lang: "es",
        }),
      ),
      http.post(`${API}/learn/projects/:id/moments/:type/complete`, ({ params }) => {
        completado(params.type);
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${API}/chat/sessions`, () => HttpResponse.json([])),
    );

    renderAt("/student/courses/p1/intro");

    expect(
      await screen.findByText("Un brazo se mueve por sus articulaciones."),
    ).toBeInTheDocument();
    // R8: el prompt de apertura abre la conversación sin que nadie pregunte.
    expect(screen.getByText("¿Qué es una articulación?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Marcar como completado/ }));
    await waitFor(() => expect(completado).toHaveBeenCalledWith("intro"));
  });

  it("la guía docente no llega a esta pantalla", async () => {
    conCatalogo();
    server.use(
      http.get(`${API}/learn/projects/:id/moments/:type`, () =>
        HttpResponse.json({
          id: "m-intro",
          type: "intro",
          order: 0,
          title: "La articulación",
          chatbot_opening_prompt: null,
          blocks: [],
          lang: "es",
        }),
      ),
      http.get(`${API}/chat/sessions`, () => HttpResponse.json([])),
    );
    renderAt("/student/courses/p1/intro");

    await screen.findByRole("heading", { name: "La articulación", level: 1 });
    // El filtro real lo hace el backend (`serialize_moment_for`); esto sólo
    // constata que la pantalla no la pide ni la pinta por su cuenta.
    expect(screen.queryByText(/teacher_note/i)).toBeNull();
  });

  it("la evaluación se responde y se envía", async () => {
    const user = userEvent.setup();
    conCatalogo({
      intro: "completed",
      inquiry: "completed",
      design: "completed",
      build: "completed",
      communicate: "completed",
    });

    const enviado = vi.fn();
    let intentos: Attempt[] = [];

    server.use(
      http.get(`${API}/learn/projects/:id/moments/:type`, () =>
        HttpResponse.json({
          id: "m-assess",
          type: "assess",
          order: 5,
          title: "Evaluación final",
          chatbot_opening_prompt: null,
          blocks: [],
          lang: "es",
        }),
      ),
      http.get(`${API}/learn/assessments/moments/:momentId`, () =>
        HttpResponse.json({
          id: "a1",
          max_attempts: 2,
          team_mode: false,
          questions: [
            {
              id: "q1",
              kind: "mcq",
              order: 0,
              points: 1,
              prompt: "¿Cuántas articulaciones tiene el brazo?",
              choices: [
                { id: "c1", order: 0, label: "Dos" },
                { id: "c2", order: 1, label: "Tres" },
              ],
            },
          ],
        }),
      ),
      http.get(`${API}/learn/assessments/:id/attempts/mine`, () =>
        HttpResponse.json(intentos),
      ),
      http.post(`${API}/learn/assessments/:id/attempts`, () => {
        const attempt: Attempt = {
          id: "at1",
          assessment_id: "a1",
          status: "in_progress",
          score: null,
          team_label: null,
          submitted_at: null,
          answers: [],
        };
        intentos = [attempt];
        return HttpResponse.json(attempt, { status: 201 });
      }),
      http.patch(`${API}/learn/assessments/attempts/:id/answers`, () =>
        HttpResponse.json({ id: "at1", answers: [] }),
      ),
      http.post(`${API}/learn/assessments/attempts/:id/submit`, async () => {
        enviado();
        intentos = [
          {
            id: "at1",
            assessment_id: "a1",
            status: "graded",
            score: 1,
            team_label: null,
            submitted_at: "2026-08-27T12:00:00Z",
            answers: [
              {
                id: "an1",
                question_id: "q1",
                choice_id: "c2",
                value_text: null,
                value_numeric: null,
                is_correct: true,
                teacher_score: null,
                teacher_feedback: null,
              },
            ],
          },
        ];
        return HttpResponse.json(intentos[0]);
      }),
    );

    renderAt("/student/courses/p1/assess");

    await user.click(await screen.findByRole("button", { name: /Comenzar/ }));
    await user.click(await screen.findByRole("radio", { name: "Tres" }));
    await user.click(screen.getByRole("button", { name: /Enviar evaluación/ }));

    await waitFor(() => expect(enviado).toHaveBeenCalled());
    const resultado = await screen.findByText("Resultado");
    expect(resultado).toBeInTheDocument();
  });

  it("el momento 6 no lleva asistente (R8: sólo momentos 1–5)", async () => {
    conCatalogo();
    server.use(
      http.get(`${API}/learn/projects/:id/moments/:type`, () =>
        HttpResponse.json({
          id: "m-assess",
          type: "assess",
          order: 5,
          title: "Evaluación final",
          chatbot_opening_prompt: null,
          blocks: [],
          lang: "es",
        }),
      ),
      http.get(`${API}/learn/assessments/moments/:momentId`, () =>
        HttpResponse.json({ id: "a1", max_attempts: 1, team_mode: false, questions: [] }),
      ),
      http.get(`${API}/learn/assessments/:id/attempts/mine`, () => HttpResponse.json([])),
    );
    renderAt("/student/courses/p1/assess");

    await screen.findByRole("heading", { name: "Evaluación final", level: 1 });
    expect(screen.queryByLabelText("Asistente de robótica")).toBeNull();
  });

  it("el personal docente tiene salida a su panel desde la vista de alumno", async () => {
    login("teacher");
    conCatalogo();
    renderAt("/student");

    const salida = await screen.findByRole("link", { name: "Panel docente" });
    expect(salida).toHaveAttribute("href", "/teacher");
  });

  it("avisa cuando el proyecto no está traducido al idioma pedido", async () => {
    conCatalogo();
    server.use(
      http.get(`${API}/learn/projects`, () =>
        HttpResponse.json([{ ...PROYECTO, lang: "en" }]),
      ),
    );
    renderAt("/student/courses");

    const tarjeta = await screen.findByRole("article");
    expect(
      within(tarjeta).getByText(/sólo está publicado en EN/),
    ).toBeInTheDocument();
  });
});
