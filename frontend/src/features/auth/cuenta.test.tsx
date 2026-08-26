/** Cambio de contraseña, navegando la app de verdad (N15).
 *
 *  Se renderiza `<App>` y se llega a la pantalla desde el enlace de la
 *  cabecera, no montando `AccountPage` suelto: un enlace que apunte a una ruta
 *  inexistente ya se coló una vez y ningún test de componente lo vio.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http as mswHttp } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import App from "@/App";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { API } from "@/test/handlers";
import { server } from "@/test/setup";

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.setItem("session", JSON.stringify({ role: "student", lang: "es" }));
  localStorage.setItem("access_token", "viejo-access");
  localStorage.setItem("refresh_token", "viejo-refresh");
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

async function irACuenta(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("link", { name: "Mi cuenta" }));
  return screen.findByRole("heading", { name: "Mi cuenta" });
}

describe("cambio de contraseña", () => {
  beforeEach(() => {
    localStorage.clear();
    server.use(
      mswHttp.get(`${API}/learn/projects`, () => HttpResponse.json([])),
    );
  });

  it("guarda el par de tokens nuevo que devuelve el backend", async () => {
    // Sin esto el usuario se queda sin sesión: el cambio revoca el refresh
    // que esta pestaña tenía guardado.
    server.use(
      mswHttp.post(`${API}/auth/me/password`, () =>
        HttpResponse.json({
          access_token: "nuevo-access",
          refresh_token: "nuevo-refresh",
          token_type: "bearer",
        }),
      ),
    );
    const user = userEvent.setup();
    renderApp();
    await irACuenta(user);

    await user.type(screen.getByLabelText("Contraseña actual"), "vieja-12345");
    await user.type(screen.getByLabelText("Contraseña nueva"), "nueva-12345");
    await user.type(screen.getByLabelText("Repetir la contraseña nueva"), "nueva-12345");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await screen.findByText(/Contraseña cambiada/);
    expect(localStorage.getItem("access_token")).toBe("nuevo-access");
    expect(localStorage.getItem("refresh_token")).toBe("nuevo-refresh");
  });

  it("no envía nada si las dos contraseñas nuevas no coinciden", async () => {
    let llamadas = 0;
    server.use(
      mswHttp.post(`${API}/auth/me/password`, () => {
        llamadas += 1;
        return HttpResponse.json({ access_token: "a", refresh_token: "r" });
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await irACuenta(user);

    await user.type(screen.getByLabelText("Contraseña actual"), "vieja-12345");
    await user.type(screen.getByLabelText("Contraseña nueva"), "nueva-12345");
    await user.type(screen.getByLabelText("Repetir la contraseña nueva"), "otra-12345");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await screen.findByText("Las dos contraseñas no coinciden.");
    expect(llamadas).toBe(0);
  });

  it("muestra el mensaje del backend cuando la contraseña actual es incorrecta", async () => {
    server.use(
      mswHttp.post(`${API}/auth/me/password`, () =>
        HttpResponse.json(
          { error: { code: "validation_failed", message: "La contraseña actual no es correcta" } },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp();
    await irACuenta(user);

    await user.type(screen.getByLabelText("Contraseña actual"), "me-la-invento");
    await user.type(screen.getByLabelText("Contraseña nueva"), "nueva-12345");
    await user.type(screen.getByLabelText("Repetir la contraseña nueva"), "nueva-12345");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await screen.findByText("La contraseña actual no es correcta");
    await waitFor(() => expect(localStorage.getItem("access_token")).toBe("viejo-access"));
  });
});
