import { Outlet } from "react-router-dom";

/** Estructura de la aplicación autenticada.
 *
 *  La referencia visual del dashboard tiene tres zonas: navegación lateral,
 *  columna central de contenido y panel derecho de perfil/agenda. El esqueleto
 *  se deja marcado aquí para que las pantallas no repitan el andamiaje, pero
 *  **sin construir nada visual todavía**: cada zona se rellena cuando se
 *  desarrolle su componente.
 */
export function AppLayout() {
  return (
    <div className="min-h-screen">
      {/* <AppSidebar /> */}
      <main>
        <Outlet />
      </main>
      {/* <AppAside /> */}
    </div>
  );
}
