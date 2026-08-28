import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { RequireAdmin, RequireAuth, RequireAuthor, RequireStaff } from "./guards";
import { routes } from "@/shared/config/routes";
import { RouteFallback } from "@/shared/ui/RouteFallback";

import { SignInPage } from "@/features/auth/SignInPage";
import { AccountPage } from "@/features/auth/AccountPage";
import { NotFoundPage } from "@/features/errors/NotFoundPage";

// Cada panel es un área con su propio armazón y su propio chunk. No hay layout
// común por encima: los cuatro traen su cabecera y su barra lateral, así que un
// envoltorio compartido sólo metía un `<main>` alrededor de otro.
const StudentPage = lazy(() => import("@/features/student/StudentPage"));
const TeacherPage = lazy(() => import("@/features/teacher/TeacherPage"));
const AdminPage = lazy(() => import("@/features/admin/AdminPage"));
const StudioPage = lazy(() => import("@/features/studio/StudioPage"));

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path={routes.login} element={<SignInPage />} />

        <Route element={<RequireAuth />}>
          {/* La raíz cae en el 404 a propósito: no hay panel común a los cuatro
              roles. `homeForRole` manda a cada uno a su herramienta al iniciar
              sesión, y ahí lo devuelve un guard si entra donde no le toca. */}
          <Route path={routes.dashboard} element={<NotFoundPage />} />

          {/* Mi cuenta es común a todos los roles y no vive dentro de ningún
              panel: es una página autónoma con su propia cabecera. */}
          <Route path={routes.account} element={<AccountPage />} />

          {/* Sin guard a propósito: el personal docente entra a ver exactamente
              lo mismo que el alumno (R4). Lo que no ve quien no es staff es la
              guía didáctica, y de eso se encarga el servidor. */}
          <Route path={`${routes.student}/*`} element={<StudentPage />} />

          <Route element={<RequireStaff />}>
            <Route path={`${routes.teacher}/*`} element={<TeacherPage />} />
          </Route>
          <Route element={<RequireAdmin />}>
            <Route path={`${routes.admin}/*`} element={<AdminPage />} />
          </Route>
          <Route element={<RequireAuthor />}>
            <Route path={`${routes.studio}/*`} element={<StudioPage />} />
          </Route>
        </Route>

        {/* 404 explícito en vez de redirigir en silencio al panel: un enlace
            roto que te deja en la portada parece que funcionó, y nadie lo
            reporta. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
