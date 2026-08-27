import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import AccountPage from "@/features/auth/AccountPage";
import LoginPage from "@/features/auth/LoginPage";
import { useAuth } from "@/features/auth/useAuth";
import LandingPage from "@/features/landing/LandingPage";
import MomentPage from "@/features/moment/MomentPage";
import ProjectPage from "@/features/projects/ProjectPage";
import ProjectsPage from "@/features/projects/ProjectsPage";

// El Content Studio nunca llega al bundle del estudiante.
const StudioPage = lazy(() => import("@/features/studio/StudioPage"));
const AdminPage = lazy(() => import("@/features/admin/AdminPage"));
const TeacherPage = lazy(() => import("@/features/teacher/TeacherPage"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}

/** "/" es pública para visitantes (landing) y el listado de proyectos para
 *  quien ya tiene sesión -- no cambia el comportamiento de `RequireAuth`. */
function HomeRoute() {
  const { session } = useAuth();
  if (!session) return <LandingPage />;
  return (
    <RequireAuth>
      <ProjectsPage />
    </RequireAuth>
  );
}

function RequireAuthor({ children }: { children: React.ReactNode }) {
  const { canAuthor } = useAuth();
  return canAuthor ? <>{children}</> : <Navigate to="/" replace />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return session?.role === "admin" ? <>{children}</> : <Navigate to="/" replace />;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const { isStaff } = useAuth();
  return isStaff ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<p className="p-6">{t("common.loading")}</p>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRoute />} />
        {/* La vista del proyecto es el eslabon que faltaba: el listado
            enlazaba aqui y no habia ruta, asi que el comodin de abajo
            devolvia al usuario al principio. */}
        <Route path="/cuenta" element={<RequireAuth><AccountPage /></RequireAuth>} />
        <Route
          path="/projects/:projectId"
          element={<RequireAuth><ProjectPage /></RequireAuth>}
        />
        <Route
          path="/projects/:projectId/moments/:momentType"
          element={<RequireAuth><MomentPage /></RequireAuth>}
        />
        <Route
          path="/studio/*"
          element={<RequireAuthor><StudioPage /></RequireAuthor>}
        />
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <RequireAdmin><AdminPage /></RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/teacher/*"
          element={
            <RequireAuth>
              <RequireStaff><TeacherPage /></RequireStaff>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
