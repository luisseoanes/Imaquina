/** Navegación del panel de administración. Monta `<App>` y navega de verdad. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { API } from "@/test/handlers";
import { server } from "@/test/server";

function login(role: "admin" | "teacher") {
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

describe("Panel de administración", () => {
  beforeEach(() => login("admin"));

  it("un admin ve la barra lateral con sus secciones", async () => {
    renderAt("/admin");
    for (const label of [
      "Panel",
      "Usuarios",
      "Cursos",
      "Moderación del chat",
      "Configuración",
    ]) {
      expect(await screen.findByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Supervisión")).toBeInTheDocument();
  });

  it("arranca en el panel", async () => {
    renderAt("/admin");
    expect(
      await screen.findByRole("heading", { name: "Panel de administración" }),
    ).toBeInTheDocument();
  });

  it("lista los usuarios de la institución", async () => {
    server.use(
      http.get(`${API}/admin/users`, () =>
        HttpResponse.json([
          {
            id: "u1",
            email: "ana@imaquina.example.com",
            full_name: "Ana Docente",
            role: "teacher",
            grade: null,
            is_active: true,
          },
        ]),
      ),
    );
    renderAt("/admin/users");
    expect(await screen.findByText("Ana Docente")).toBeInTheDocument();
  });

  it("navega a Moderación del chat", async () => {
    renderAt("/admin");
    await userEvent.click(
      await screen.findByRole("link", { name: "Moderación del chat" }),
    );
    expect(
      await screen.findByText(/No hay mensajes redirigidos/i),
    ).toBeInTheDocument();
  });

  it("Auditoría: muestra el registro vacío", async () => {
    renderAt("/admin/audit");
    expect(await screen.findByText(/sin registros/i)).toBeInTheDocument();
  });

  it("un docente no entra a administración", async () => {
    localStorage.clear();
    login("teacher");
    renderAt("/admin");
    await waitFor(() =>
      expect(document.querySelector("[data-admin-root]")).toBeNull(),
    );
  });
});
