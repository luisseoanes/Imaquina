import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import LoginPage from "@/features/auth/LoginPage";
import { useAuth } from "@/features/auth/useAuth";
import MomentPage from "@/features/moment/MomentPage";
import ProjectPage from "@/features/projects/ProjectPage";
import ProjectsPage from "@/features/projects/ProjectsPage";

// El Content Studio nunca llega al bundle del estudiante.
const StudioPage = lazy(() => import("@/features/studio/StudioPage"));

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

function RequireAuthor({ children }: { children: React.ReactNode }) {
  const { canAuthor } = useAuth();
  return canAuthor ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<p className="p-6">{t("common.loading")}</p>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><ProjectsPage /></RequireAuth>} />
        {/* La vista del proyecto es el eslabon que faltaba: el listado
            enlazaba aqui y no habia ruta, asi que el comodin de abajo
            devolvia al usuario al principio. */}
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
