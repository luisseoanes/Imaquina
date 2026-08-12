import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "@/features/auth/LoginPage";
import { useAuth } from "@/features/auth/useAuth";
import MomentPage from "@/features/moment/MomentPage";
import ProjectsPage from "@/features/projects/ProjectsPage";

// El Content Studio nunca llega al bundle del estudiante.
const StudioPage = lazy(() => import("@/features/studio/StudioPage"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return session ? <>{children}</> : <Navigate to="/login" replace />;
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
