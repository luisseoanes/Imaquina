/** Panel del estudiante (rol student, y el resto de roles cuando quieren ver
 *  lo mismo que el alumno — R4).
 *
 *  Vive bajo `/student/*` como área propia, igual que el panel del docente, el
 *  Content Studio y administración: la raíz `/` sigue mostrando el 404 y
 *  `homeForRole` es quien reparte a cada rol su herramienta.
 *
 *  Va en `lazy()` desde el router como los demás paneles. Cuidado con lo que se
 *  importa aquí: los `robot-*.svg` llevan un PNG embebido y pesan entre 366 y
 *  633 KB, y este es el chunk que carga un alumno desde el celular.
 *
 *  Marca `data-student-root` para el test del router.
 */
import { Navigate, Route, Routes } from "react-router-dom";

import { StudentLayout } from "./StudentLayout";
import { AgendaView } from "./views/AgendaView";
import { AssignmentsView } from "./views/AssignmentsView";
import { DashboardView } from "./views/DashboardView";
import { MomentView } from "./views/MomentView";
import { ProjectDetailView } from "./views/ProjectDetailView";
import { ProjectsView } from "./views/ProjectsView";

export function StudentPage() {
  return (
    <div data-student-root>
      <Routes>
        <Route element={<StudentLayout />}>
          <Route index element={<DashboardView />} />
          <Route path="agenda" element={<AgendaView />} />
          <Route path="courses" element={<ProjectsView />} />
          <Route path="courses/:projectId" element={<ProjectDetailView />} />
          <Route path="courses/:projectId/:momentType" element={<MomentView />} />
          <Route path="assignments" element={<AssignmentsView />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Route>
      </Routes>
    </div>
  );
}

export default StudentPage;
