/** Navegación del Content Studio.
 *
 *  Se monta `<App>` con un `MemoryRouter` y se navega de verdad: los enlaces
 *  entre pestañas y los guards de rol no los ve ningún test de componente
 *  aislado (CLAUDE.md § Tests).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { API } from "@/test/handlers";
import { server } from "@/test/server";

function login(role: "editor" | "student") {
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

describe("Content Studio", () => {
  beforeEach(() => login("editor"));

  it("un editor ve la barra lateral con las 14 pestañas del mockup", async () => {
    renderAt("/studio");
    for (const label of [
      "Dashboard",
      "Mis Contenidos",
      "Lecciones",
      "Recursos",
      "Proyectos",
      "Evaluaciones",
      "Rutas de Aprendizaje",
      "Biblioteca de Medios",
      "Plantillas",
      "Etiquetas",
      "Colecciones",
      "Analítica de Rendimiento",
      "Estudiantes y Actividad",
      "Configuración",
    ]) {
      expect(
        await screen.findByRole("link", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("el panel arranca en el dashboard", async () => {
    renderAt("/studio");
    // El saludo va en la barra superior; el h1 del dashboard es sobrio.
    expect(
      await screen.findByRole("heading", { name: "Resumen" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/¡Hola, /)).toBeInTheDocument();
  });

  it("navega a Lecciones y muestra su estado vacío", async () => {
    server.use(
      http.get(`${API}/studio/lessons`, () => HttpResponse.json([])),
    );
    renderAt("/studio");
    await userEvent.click(await screen.findByRole("link", { name: "Lecciones" }));
    expect(
      await screen.findByText(/no has creado lecciones/i),
    ).toBeInTheDocument();
  });

  it("lista las lecciones que devuelve el backend", async () => {
    server.use(
      http.get(`${API}/studio/lessons`, () =>
        HttpResponse.json([
          {
            id: "l1",
            slug: "sensor-ultrasonido",
            area: "Electrónica",
            grade: null,
            status: "draft",
            estimated_minutes: 20,
            lang: "es",
            title: "Sensor de ultrasonido",
            summary: null,
            body: null,
            langs: ["es"],
            updated_at: "2026-08-20T10:00:00Z",
          },
        ]),
      ),
    );
    renderAt("/studio/lessons");
    expect(
      await screen.findByText("Sensor de ultrasonido"),
    ).toBeInTheDocument();
  });

  it("Mis Contenidos: KPIs, tabla, accesos rápidos y panel derecho", async () => {
    server.use(
      http.get(`${API}/studio/catalog/projects`, () =>
        HttpResponse.json([
          {
            id: "p1",
            slug: "carro-solar",
            grade: "3",
            kit: null,
            order: 1,
            status: "published",
            lang: "es",
            title: "Carro solar",
            summary: null,
            langs: ["es"],
            updated_at: "2026-08-25T10:00:00Z",
          },
        ]),
      ),
    );
    renderAt("/studio/contents");
    // Header + KPIs
    expect(
      await screen.findByRole("heading", { name: "Mis Contenidos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Total de contenidos")).toBeInTheDocument();
    expect(screen.getByText("Estudiantes impactados")).toBeInTheDocument();
    // Fila de la tabla con el proyecto
    expect(await screen.findByText("Carro solar")).toBeInTheDocument();
    // Secciones nuevas
    expect(screen.getByText("Crear nuevo contenido")).toBeInTheDocument();
    expect(screen.getByText("Rendimiento de contenido")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Nuevo proyecto/i }),
    ).toBeInTheDocument();
    // Panel derecho: centro de ayuda + recordatorios
    expect(screen.getByText("Centro de ayuda")).toBeInTheDocument();
    expect(screen.getByText("Recordatorios")).toBeInTheDocument();
  });

  it("agrupa la navegación por secciones", async () => {
    renderAt("/studio");
    expect(await screen.findByText("Crear contenido")).toBeInTheDocument();
    expect(screen.getByText("Gestión")).toBeInTheDocument();
    expect(screen.getByText("Analítica")).toBeInTheDocument();
  });

  it("un estudiante no entra: lo devuelve al panel general", async () => {
    localStorage.clear();
    login("student");
    renderAt("/studio");
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Plantillas" })).toBeNull(),
    );
  });
});
