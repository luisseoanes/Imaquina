import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Route, Routes } from "react-router-dom";

import type { Lang } from "./api";
import MomentEditor from "./MomentEditor";
import ProjectDetail from "./ProjectDetail";
import ProjectsList from "./ProjectsList";

const IDIOMAS: Lang[] = ["es", "en"];

/** Content Studio: el módulo con el que el cliente carga los 34 proyectos
 *  restantes. Va en bundle aparte (ver `manualChunks` en vite.config.ts): los
 *  estudiantes son el 95% del tráfico y no deben descargar el editor. */
export default function StudioPage() {
  const { t } = useTranslation();
  // El idioma de EDICIÓN, que no es el de la interfaz: se puede trabajar la
  // traducción al inglés con la UI en español.
  const [lang, setLang] = useState<Lang>("es");

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center gap-4">
        <Link to="." className="text-2xl font-bold">
          {t("studio.title")}
        </Link>
        <nav className="ml-auto flex gap-1" aria-label={t("studio.projects")}>
          {IDIOMAS.map((codigo) => (
            <button
              key={codigo}
              onClick={() => setLang(codigo)}
              aria-pressed={lang === codigo}
              className={`rounded px-3 py-1 text-sm uppercase ${
                lang === codigo ? "bg-brand text-brand-content" : "border"
              }`}
            >
              {codigo}
            </button>
          ))}
        </nav>
      </header>

      <Routes>
        <Route index element={<ProjectsList lang={lang} />} />
        <Route path="projects/:projectId" element={<ProjectDetail lang={lang} />} />
        <Route
          path="projects/:projectId/moments/:momentId"
          element={<MomentEditor lang={lang} />}
        />
      </Routes>
    </main>
  );
}
