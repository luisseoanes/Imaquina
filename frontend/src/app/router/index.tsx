import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { RequireAdmin, RequireAuth, RequireAuthor, RequireStaff } from "./guards";
import { AppLayout } from "@/app/layouts/AppLayout";
import { routes } from "@/shared/config/routes";
import { RouteFallback } from "@/shared/ui/RouteFallback";

import { SignInPage } from "@/features/auth/SignInPage";
import { CoursesPage } from "@/features/courses/CoursesPage";
import { CourseDetailPage } from "@/features/courses/CourseDetailPage";
import { MomentPage } from "@/features/moments/MomentPage";
import { AssignmentsPage } from "@/features/assessments/AssignmentsPage";
import { AccountPage } from "@/features/auth/AccountPage";
import { NotFoundPage } from "@/features/errors/NotFoundPage";

// Diferidos: sólo los usa personal docente o de autoría, que es una minoría
// del tráfico. El Content Studio además arrastra el editor de contenido, que
// no tiene por qué llegar al bundle de un estudiante.
const TeacherPage = lazy(() => import("@/features/teacher/TeacherPage"));
const AdminPage = lazy(() => import("@/features/admin/AdminPage"));
const StudioPage = lazy(() => import("@/features/studio/StudioPage"));
const StudentPage = lazy(() => import("@/features/student/StudentPage"));

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path={routes.login} element={<SignInPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            {/* La raíz cae en el 404 a propósito: el panel no está
                construido y enseñar un marcador vacío es peor que decir que
                esa página todavía no existe. Cuando se desarrolle, aquí
                vuelve `<DashboardPage />`. */}
            <Route path={routes.dashboard} element={<NotFoundPage />} />
            <Route path={routes.courses} element={<CoursesPage />} />
            <Route path="/courses/:projectId" element={<CourseDetailPage />} />
            <Route path="/courses/:projectId/:momentType" element={<MomentPage />} />
            <Route path={routes.assignments} element={<AssignmentsPage />} />
            <Route path={routes.account} element={<AccountPage />} />
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
        </Route>

        {/* 404 explícito en vez de redirigir en silencio al panel: un enlace
            roto que te deja en la portada parece que funcionó, y nadie lo
            reporta. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
