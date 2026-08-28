import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAdmin, RequireAuth, RequireAuthor, RequireStaff } from "./guards";
import { AppLayout } from "@/app/layouts/AppLayout";
import { routes } from "@/shared/config/routes";
import { RouteFallback } from "@/shared/ui/RouteFallback";

import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { CoursesPage } from "@/features/courses/CoursesPage";
import { CourseDetailPage } from "@/features/courses/CourseDetailPage";
import { MomentPage } from "@/features/moments/MomentPage";
import { AssignmentsPage } from "@/features/assessments/AssignmentsPage";
import { AccountPage } from "@/features/auth/AccountPage";

// Diferidos: sólo los usa personal docente o de autoría, que es una minoría
// del tráfico. El Content Studio además arrastra el editor de contenido, que
// no tiene por qué llegar al bundle de un estudiante.
const TeacherPage = lazy(() => import("@/features/teacher/TeacherPage"));
const AdminPage = lazy(() => import("@/features/admin/AdminPage"));
const StudioPage = lazy(() => import("@/features/studio/StudioPage"));

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path={routes.login} element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path={routes.dashboard} element={<DashboardPage />} />
            <Route path={routes.courses} element={<CoursesPage />} />
            <Route path="/courses/:projectId" element={<CourseDetailPage />} />
            <Route path="/courses/:projectId/:momentType" element={<MomentPage />} />
            <Route path={routes.assignments} element={<AssignmentsPage />} />
            <Route path={routes.account} element={<AccountPage />} />

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

        <Route path="*" element={<Navigate to={routes.dashboard} replace />} />
      </Routes>
    </Suspense>
  );
}
