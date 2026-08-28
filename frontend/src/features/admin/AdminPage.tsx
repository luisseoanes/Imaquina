/** Panel de administración (rol admin).
 *
 *  Chunk aparte con `lazy()` en el router. Marca `data-admin-root` para que el
 *  test del router sepa que montó.
 */
import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AdminContext } from "./AdminContext";
import { AdminLayout } from "./AdminLayout";

import { CourseDetailView } from "./views/CourseDetailView";
import { CoursesView } from "./views/CoursesView";
import { DashboardView } from "./views/DashboardView";
import { ModerationView } from "./views/ModerationView";
import { SettingsView } from "./views/SettingsView";
import { UsersView } from "./views/UsersView";

export function AdminPage() {
  const [search, setSearch] = useState("");
  const value = useMemo(() => ({ search, setSearch }), [search]);

  return (
    <AdminContext.Provider value={value}>
      <div data-admin-root>
        <AdminLayout>
          <Routes>
            <Route index element={<DashboardView />} />
            <Route path="users" element={<UsersView />} />
            <Route path="courses" element={<CoursesView />} />
            <Route path="courses/:courseId" element={<CourseDetailView />} />
            <Route path="moderation" element={<ModerationView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </AdminLayout>
      </div>
    </AdminContext.Provider>
  );
}

export default AdminPage;
