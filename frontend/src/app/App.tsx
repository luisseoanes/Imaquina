import { AuthProvider } from "@/app/providers/AuthProvider";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { AppRouter } from "@/app/router";

/** Composición raíz.
 *
 *  El `BrowserRouter` se queda FUERA (en `main.tsx`) a propósito: así los
 *  tests pueden montar `<App />` con un `MemoryRouter` y navegar de verdad,
 *  que es la única forma de detectar un enlace que apunta a una ruta
 *  inexistente.
 */
export function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryProvider>
  );
}
