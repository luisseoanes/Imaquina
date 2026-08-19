/** `isStaff` y `canAuthor` son el espejo en cliente de los roles del backend:
 *  deciden QUE PINTAR, no autorizan nada. Si se desalinean con
 *  `app/core/deps.TenantContext`, la UI ofrece botones que el servidor rechaza. */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { AuthProvider, useAuth } from "./useAuth";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("useAuth", () => {
  it("arranca sin sesión", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.session).toBeNull();
    expect(result.current.isStaff).toBe(false);
    expect(result.current.canAuthor).toBe(false);
  });

  it("el login guarda el token de acceso y la sesión", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login("docente@colegio.edu", "secreta");
    });

    await waitFor(() => expect(result.current.session).not.toBeNull());
    expect(result.current.session?.role).toBe("teacher");
    expect(localStorage.getItem("access_token")).toBe("token-de-acceso");
  });

  it("el docente es staff pero NO puede autorear: el Studio es de editor/admin", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login("docente@colegio.edu", "secreta");
    });

    await waitFor(() => expect(result.current.isStaff).toBe(true));
    expect(result.current.canAuthor).toBe(false);
  });

  it("el logout borra sesión y token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("docente@colegio.edu", "secreta");
    });
    await waitFor(() => expect(result.current.session).not.toBeNull());

    act(() => result.current.logout());

    expect(result.current.session).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("session")).toBeNull();
  });
});
