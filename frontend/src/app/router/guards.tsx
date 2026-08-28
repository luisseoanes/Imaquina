import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/shared/hooks/useAuth";
import { routes } from "@/shared/config/routes";
import { canAuthor, isAdmin, isStaff } from "@/shared/config/roles";
import type { Role } from "@/shared/config/roles";

/** Guards de ruta.
 *
 *  Deciden QUÉ SE PINTA, no qué se permite: el servidor autoriza cada petición
 *  por su cuenta. Saltarse esto en el navegador no da acceso a ningún dato.
 *
 *  Son `<Outlet>` y no envoltorios de children para poder anidarlos en la
 *  definición de rutas sin envolver cada elemento a mano.
 */
export function RequireAuth() {
  const { session } = useAuth();
  return session ? <Outlet /> : <Navigate to={routes.login} replace />;
}

function RequireRole({ permite }: { permite: (role: Role) => boolean }) {
  const { session } = useAuth();
  if (!session) return <Navigate to={routes.login} replace />;
  return permite(session.role) ? <Outlet /> : <Navigate to={routes.dashboard} replace />;
}

export const RequireStaff = () => <RequireRole permite={isStaff} />;
export const RequireAuthor = () => <RequireRole permite={canAuthor} />;
export const RequireAdmin = () => <RequireRole permite={isAdmin} />;
