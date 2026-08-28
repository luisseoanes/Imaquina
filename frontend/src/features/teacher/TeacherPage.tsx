/** Panel del docente (rol teacher/editor/admin).
 *
 *  Chunk aparte con `lazy()` en el router: sólo lo usa personal docente. Marca
 *  `data-teacher-root` para que el test del router sepa que montó.
 */
import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { idiomaGuardado } from "@/shared/i18n";
import type { Lang } from "@/shared/config/roles";
import { TeacherContext } from "./TeacherContext";
import { TeacherLayout } from "./TeacherLayout";

import { AgendaView } from "./views/AgendaView";
import { AssignmentsView } from "./views/AssignmentsView";
import { CourseDetailView } from "./views/CourseDetailView";
import { CoursesView } from "./views/CoursesView";
import { DashboardView } from "./views/DashboardView";
import { ContentProjectView } from "./views/ContentProjectView";
import { ContentView } from "./views/ContentView";
import { GradingView } from "./views/GradingView";
import { ProgressView } from "./views/ProgressView";
import { SettingsView } from "./views/SettingsView";

export function TeacherPage() {
  const [lang, setLang] = useState<Lang>(() => idiomaGuardado());
  const [search, setSearch] = useState("");
  const value = useMemo(
    () => ({ lang, setLang, search, setSearch }),
    [lang, search],
  );

  return (
    <TeacherContext.Provider value={value}>
      <div data-teacher-root>
        <TeacherLayout>
          <Routes>
            <Route index element={<DashboardView />} />
            <Route path="assignments" element={<AssignmentsView />} />
            <Route path="agenda" element={<AgendaView />} />
            <Route path="courses" element={<CoursesView />} />
            <Route path="courses/:courseId" element={<CourseDetailView />} />
            <Route path="progress" element={<ProgressView />} />
            <Route path="grading" element={<GradingView />} />
            <Route path="content" element={<ContentView />} />
            <Route path="content/:projectId" element={<ContentProjectView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/teacher" replace />} />
          </Routes>
        </TeacherLayout>
      </div>
    </TeacherContext.Provider>
  );
}

export default TeacherPage;
