import { HttpResponse, http } from "msw";

import { env } from "@/shared/config/env";

export const API = env.apiBaseUrl;

/** Handlers por defecto: el logout best-effort que la app dispara sola, más
 *  una base vacía de los listados del Content Studio para que montar una
 *  pantalla del Studio en un test no salga a la red. Un test que necesite
 *  datos concretos los declara con `server.use(...)`. */
const emptyDashboard = {
  content: {
    projects: { total: 0, published: 0 },
    lessons: { total: 0, published: 0 },
    resources: 0,
    paths: 0,
    collections: 0,
  },
  students_impacted: 0,
  performance: { submitted_attempts: 0, avg_score: null, completed_moments: 0 },
  recent: [],
};

export const handlers = [
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({
      id: "u1",
      email: "editor@imaquina.example.com",
      full_name: "Editora de Contenido",
      role: "editor",
      grade: null,
      lang: "es",
    }),
  ),

  http.get(`${API}/studio/dashboard`, () => HttpResponse.json(emptyDashboard)),
  http.get(`${API}/studio/analytics/assessments`, () => HttpResponse.json([])),
  http.get(`${API}/studio/students`, () => HttpResponse.json([])),
  http.get(`${API}/studio/catalog/projects`, () => HttpResponse.json([])),
  http.get(`${API}/studio/lessons`, () => HttpResponse.json([])),
  http.get(`${API}/studio/resources`, () => HttpResponse.json([])),
  http.get(`${API}/studio/paths`, () => HttpResponse.json([])),
  http.get(`${API}/studio/templates`, () => HttpResponse.json([])),
  http.get(`${API}/studio/tags`, () => HttpResponse.json([])),
  http.get(`${API}/studio/collections`, () => HttpResponse.json([])),
  http.get(`${API}/studio/media/assets`, () =>
    HttpResponse.json({ total: 0, items: [] }),
  ),

  // Panel del docente
  http.get(`${API}/courses`, () => HttpResponse.json([])),
  http.get(`${API}/learn/projects`, () => HttpResponse.json([])),

  // Panel de administración
  http.get(`${API}/admin/users`, () => HttpResponse.json([])),
  http.get(`${API}/studio/assistant/rejections`, () => HttpResponse.json([])),
];
