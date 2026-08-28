/** Navegación del panel del docente.
 *
 *  Se monta `<App>` con un `MemoryRouter` y se navega de verdad.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { API } from "@/test/handlers";
import { server } from "@/test/server";

function login(role: "teacher" | "student") {
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

describe("Panel del docente", () => {
  beforeEach(() => login("teacher"));

  it("un docente ve la barra lateral con sus secciones", async () => {
    renderAt("/teacher");
    for (const label of [
      "Panel",
      "Mis cursos",
      "Progreso",
      "Calificación",
      "Contenido",
      "Configuración",
    ]) {
      expect(await screen.findByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Seguimiento")).toBeInTheDocument();
  });

  it("arranca en su panel", async () => {
    renderAt("/teacher");
    expect(
      await screen.findByRole("heading", { name: "Tu panel docente" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/¡Hola, /)).toBeInTheDocument();
  });

  it("lista los cursos del docente", async () => {
    server.use(
      http.get(`${API}/courses`, () =>
        HttpResponse.json([
          { id: "c1", name: "5A · Robótica", grade: "5", teacher_id: "t1" },
        ]),
      ),
    );
    renderAt("/teacher/courses");
    expect(await screen.findByText("5A · Robótica")).toBeInTheDocument();
  });

  it("progreso pide curso y proyecto antes de mostrar la tabla", async () => {
    renderAt("/teacher/progress");
    expect(
      await screen.findByText(/Elige un curso y un proyecto/i),
    ).toBeInTheDocument();
  });

  it("navega a Calificación", async () => {
    renderAt("/teacher");
    await userEvent.click(
      await screen.findByRole("link", { name: "Calificación" }),
    );
    expect(
      await screen.findByText(/Elige un proyecto para revisar/i),
    ).toBeInTheDocument();
  });

  it("un estudiante no entra al panel del docente", async () => {
    localStorage.clear();
    login("student");
    renderAt("/teacher");
    await waitFor(() =>
      expect(document.querySelector("[data-teacher-root]")).toBeNull(),
    );
  });
});
