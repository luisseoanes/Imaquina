/** Content Studio: autoría y publicación (rol editor/admin).
 *
 *  Va en su propio chunk vía `lazy()` en el router: los estudiantes son el 95%
 *  del tráfico y no deben descargar el editor.
 *
 *  Marca `data-studio-root` para que el test del router sepa que montó (las
 *  pantallas ya no son marcadores `data-pending`).
 */
import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { StudioContext } from "./StudioContext";
import { StudioLayout } from "./StudioLayout";
import { idiomaGuardado } from "@/shared/i18n";
import type { Lang } from "@/shared/config/roles";

import { DashboardView } from "./views/DashboardView";
import { ContentsView } from "./views/ContentsView";
import { LessonsView } from "./views/LessonsView";
import { ResourcesView } from "./views/ResourcesView";
import { ProjectsView } from "./views/ProjectsView";
import { ProjectEditorView } from "./views/ProjectEditorView";
import { MomentEditorView } from "./views/MomentEditorView";
import { AssessmentsView } from "./views/AssessmentsView";
import { PathsView } from "./views/PathsView";
import { MediaLibraryView } from "./views/MediaLibraryView";
import { TemplatesView } from "./views/TemplatesView";
import { TagsView } from "./views/TagsView";
import { CollectionsView } from "./views/CollectionsView";
import { AnalyticsView } from "./views/AnalyticsView";
import { StudentsView } from "./views/StudentsView";
import { SettingsView } from "./views/SettingsView";

export function StudioPage() {
  const [lang, setLang] = useState<Lang>(() => idiomaGuardado());
  const [search, setSearch] = useState("");
  const value = useMemo(
    () => ({ lang, setLang, search, setSearch }),
    [lang, search],
  );

  return (
    <StudioContext.Provider value={value}>
      <div data-studio-root>
        <StudioLayout>
          <Routes>
            <Route index element={<DashboardView />} />
            <Route path="contents" element={<ContentsView />} />
            <Route path="lessons" element={<LessonsView />} />
            <Route path="resources" element={<ResourcesView />} />
            <Route path="projects" element={<ProjectsView />} />
            <Route path="projects/:projectId" element={<ProjectEditorView />} />
            <Route
              path="projects/:projectId/moments/:momentId"
              element={<MomentEditorView />}
            />
            <Route path="assessments" element={<AssessmentsView />} />
            <Route path="paths" element={<PathsView />} />
            <Route path="paths/:pathId" element={<PathsView />} />
            <Route path="media" element={<MediaLibraryView />} />
            <Route path="templates" element={<TemplatesView />} />
            <Route path="tags" element={<TagsView />} />
            <Route path="collections" element={<CollectionsView />} />
            <Route path="collections/:collectionId" element={<CollectionsView />} />
            <Route path="analytics" element={<AnalyticsView />} />
            <Route path="students" element={<StudentsView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/studio" replace />} />
          </Routes>
        </StudioLayout>
      </div>
    </StudioContext.Provider>
  );
}

export default StudioPage;
